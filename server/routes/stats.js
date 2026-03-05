const express = require('express');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const { auth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Зведена статистика для Dashboard
router.get('/overview', auth, async (req, res) => {
  try {
    const { city, days = 30 } = req.query;
    
    // Базова фільтрація по ownerId для не-superadmin
    const ownerFilter = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };

    // Додаткова фільтрація по місту (лише якщо явно вказано через ?city=)
    const testFilter = { ...ownerFilter, ...(city ? { studentCity: city } : {}) };
    const quizFilter = { ...ownerFilter, ...(city ? { studentCity: city } : {}) };
    const gameFilter = { ...ownerFilter, ...(city ? { city } : {}) };

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const [testResults, gameResults, quizResults] = await Promise.all([
      TestResult.find(testFilter).sort({ completedAt: -1 }),
      GameResult.find(gameFilter).sort({ completedAt: -1 }),
      QuizResult.find(quizFilter).sort({ completedAt: -1 })
    ]);
    
    const allResults = [
      ...testResults.map(r => ({ ...r.toObject(), type: 'test', passed: r.passed, percentage: r.percentage })),
      ...gameResults.map(r => ({ ...r.toObject(), type: 'game', passed: r.isWin })),
      ...quizResults.map(r => ({ ...r.toObject(), type: 'quiz', passed: r.percentage >= 80, percentage: r.percentage }))
    ];
    
    // Статистика по днях (останні 14 днів)
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
    
    const chartData = Object.values(resultsByDay).slice(-14);
    
    // Топ-5 найнижчих результатів
    const sortedByScore = [...allResults].sort((a, b) => (a.percentage || 0) - (b.percentage || 0));
    const weakSpots = sortedByScore.slice(0, 5).map(r => ({
      student: `${r.studentLastName || r.playerLastName} ${r.studentName || r.playerName}`,
      type: r.type,
      percentage: r.percentage || (r.passed ? 100 : 0),
      date: new Date(r.completedAt).toLocaleDateString('uk-UA')
    }));
    
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
      avgByType,
      byType: {
        test: testResults.length,
        game: gameResults.length,
        quiz: quizResults.length
      },
      recentResults: allResults.slice(0, 10)
    });
  } catch (err) {
    logger.error('Stats overview error:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// Отримати список міст для фільтрів
router.get('/cities', auth, async (req, res) => {
  try {
    const ownerFilter = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };

    // Отримуємо унікальні міста лише зі своїх результатів
    const [testCities, gameCities, quizCities] = await Promise.all([
      TestResult.distinct('studentCity', ownerFilter),
      GameResult.distinct('city', ownerFilter),
      QuizResult.distinct('studentCity', ownerFilter)
    ]);

    const allCities = [...new Set([...testCities, ...gameCities, ...quizCities])].filter(Boolean);

    res.json(allCities);
  } catch (err) {
    logger.error('Stats cities error:', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
