const express = require('express');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { buildResultFilter } = require('../utils/platformFilter');
const { DASHBOARD_ROLES } = require('../utils/accessPolicy');
const logger = require('../utils/logger');

const router = express.Router();

const getResultFirstName = (result) => result?.studentName || result?.playerName || '';
const getResultLastName = (result) => result?.studentLastName || result?.playerLastName || '';
const getResultCity = (result) => result?.studentCity || result?.playerCity || result?.city || '';
const getResultPosition = (result) => result?.studentPosition || result?.playerPosition || result?.position || '';
const getResultPercentage = (result) => {
  if (typeof result?.percentage === 'number') {
    return result.percentage;
  }
  return result?.passed ? 100 : 0;
};

const buildAggregateSummary = (results, getValue) => {
  const summaryMap = new Map();

  results.forEach((result) => {
    const key = getValue(result) || 'Невідомо';
    if (!summaryMap.has(key)) {
      summaryMap.set(key, { name: key, count: 0, passed: 0, totalPercentage: 0 });
    }

    const bucket = summaryMap.get(key);
    bucket.count += 1;
    if (result.passed) {
      bucket.passed += 1;
    }
    bucket.totalPercentage += getResultPercentage(result);
  });

  return Array.from(summaryMap.values())
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      passed: entry.passed,
      failed: entry.count - entry.passed,
      successRate: entry.count > 0 ? Math.round((entry.passed / entry.count) * 100) : 0,
      avgPercentage: entry.count > 0 ? Math.round(entry.totalPercentage / entry.count) : 0
    }))
    .sort((left, right) => right.count - left.count || right.successRate - left.successRate);
};

// Зведена статистика для Dashboard
router.get('/overview', auth, checkRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const { city, days = 30 } = req.query;

    // Date filter
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    const dateFilter = { completedAt: { $gte: daysAgo } };

    // Role-based filter (platform-scoped)
    const platformBase = await buildResultFilter(req.user, 'studentCity');
    let baseFilter;
    if (Object.keys(platformBase).length === 0) {
      baseFilter = { ...dateFilter };
    } else {
      baseFilter = { $and: [dateFilter, platformBase] };
    }

    // City filter
    const getFilter = (cityField) => {
      if (city) {
        return { $and: [baseFilter, { [cityField]: city }] };
      }
      return baseFilter;
    };

    const testFilter = getFilter('studentCity');
    const quizFilter = getFilter('studentCity');
    const gameFilter = getFilter('city');
    const complexFilter = getFilter('studentCity');

    const [testResults, gameResults, quizResults, complexResults] = await Promise.all([
      TestResult.find(testFilter).sort({ completedAt: -1 }),
      GameResult.find(gameFilter).sort({ completedAt: -1 }),
      QuizResult.find(quizFilter).sort({ completedAt: -1 }),
      ComplexTestResult.find(complexFilter).sort({ completedAt: -1 })
    ]);

    const complexPct = (r) => {
      if (!r.steps || r.steps.length === 0) return 0;
      const avg = r.steps.reduce((s, st) => s + (st.percentage || 0), 0) / r.steps.length;
      return Math.round(avg);
    };

    const allResults = [
      ...testResults.map(r => ({ ...r.toObject(), type: 'test', passed: r.passed, percentage: r.percentage })),
      ...gameResults.map(r => ({ ...r.toObject(), type: 'game', passed: r.isWin, percentage: r.isWin ? 100 : 0 })),
      ...quizResults.map(r => ({ ...r.toObject(), type: 'quiz', passed: r.percentage >= 80, percentage: r.percentage })),
      ...complexResults.map(r => ({ ...r.toObject(), type: 'complex', passed: r.overallPassed, percentage: complexPct(r) }))
    ];

    // Статистика по днях
    const resultsByDay = {};
    allResults.forEach(result => {
      const date = new Date(result.completedAt).toLocaleDateString('uk-UA');
      if (!resultsByDay[date]) {
        resultsByDay[date] = { date, passed: 0, failed: 0, total: 0 };
      }
      resultsByDay[date].total++;
      if (result.passed) {
        resultsByDay[date].passed++;
      } else {
        resultsByDay[date].failed++;
      }
    });

    const chartData = Object.values(resultsByDay)
      .sort((left, right) => {
        const [leftDay, leftMonth, leftYear] = left.date.split('.').map(Number);
        const [rightDay, rightMonth, rightYear] = right.date.split('.').map(Number);
        return new Date(leftYear, leftMonth - 1, leftDay) - new Date(rightYear, rightMonth - 1, rightDay);
      })
      .slice(-14);

    // Топ-5 найнижчих результатів
    const sortedByScore = [...allResults].sort((a, b) => (a.percentage || 0) - (b.percentage || 0));
    const weakSpots = sortedByScore.slice(0, 5).map(r => ({
      student: `${getResultLastName(r)} ${getResultFirstName(r)}`.trim(),
      type: r.type,
      percentage: r.percentage || (r.passed ? 100 : 0),
      date: new Date(r.completedAt).toLocaleDateString('uk-UA')
    }));

    const byCity = buildAggregateSummary(allResults, getResultCity);
    const byPosition = buildAggregateSummary(allResults, getResultPosition);

    // Середній % по типах тестів
    const avgByType = {
      test: testResults.length > 0
        ? Math.round(testResults.reduce((sum, r) => sum + r.percentage, 0) / testResults.length)
        : 0,
      game: gameResults.length > 0
        ? Math.round((gameResults.filter(r => r.isWin).length / gameResults.length) * 100)
        : 0,
      quiz: quizResults.length > 0
        ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length)
        : 0,
      complex: complexResults.length > 0
        ? Math.round((complexResults.filter(r => r.overallPassed).length / complexResults.length) * 100)
        : 0
    };

    // Загальна статистика
    const totalResults = allResults.length;
    const passedResults = allResults.filter(r => r.passed).length;
    const overallPercentage = totalResults > 0 ? Math.round((passedResults / totalResults) * 100) : 0;

    res.json({
      totalResults,
      passedResults,
      failedResults: totalResults - passedResults,
      overallPercentage,
      chartData,
      weakSpots,
      byCity,
      byPosition,
      avgByType,
      byType: {
        test: testResults.length,
        game: gameResults.length,
        quiz: quizResults.length,
        complex: complexResults.length
      },
      recentResults: [...allResults]
        .sort((left, right) => new Date(right.completedAt) - new Date(left.completedAt))
        .slice(0, 10)
    });
  } catch (err) {
    logger.error('Stats overview error:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// Отримати список міст для фільтрів
router.get('/cities', auth, checkRole(DASHBOARD_ROLES), async (req, res) => {
  try {
    const ownerFilter = await buildResultFilter(req.user, 'studentCity');

    // Отримуємо унікальні міста лише з тих результатів, до яких є доступ
    const [testCities, gameCities, quizCities, complexCities] = await Promise.all([
      TestResult.distinct('studentCity', ownerFilter),
      GameResult.distinct('city', ownerFilter),
      QuizResult.distinct('studentCity', ownerFilter),
      ComplexTestResult.distinct('studentCity', ownerFilter)
    ]);

    const allCities = [...new Set([...testCities, ...gameCities, ...quizCities, ...complexCities])].filter(Boolean);

    res.json(allCities);
  } catch (err) {
    logger.error('Stats cities error:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
