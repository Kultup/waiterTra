const express = require('express');
const router = express.Router();
const PageView = require('../models/PageView');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const DeskTest = require('../models/DeskTest');
const GameLink = require('../models/GameLink');
const QuizLink = require('../models/QuizLink');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { getPlatformUserIds } = require('../utils/platformFilter');

const analyticsAuth = [auth, checkRole(['localadmin'])];

// Утиліта: початок дня
const startOf = (days = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
};

// GET /api/analytics/overview — загальна статистика
router.get('/overview', analyticsAuth, async (req, res) => {
    try {
        const todayStart = startOf(0);
        const weekStart = startOf(7);
        const monthStart = startOf(30);

        const [
            viewsToday, viewsWeek, viewsMonth, viewsTotal,
            completionsToday, completionsWeek, completionsMonth
        ] = await Promise.all([
            PageView.countDocuments({ createdAt: { $gte: todayStart } }),
            PageView.countDocuments({ createdAt: { $gte: weekStart } }),
            PageView.countDocuments({ createdAt: { $gte: monthStart } }),
            PageView.countDocuments({}),

            // Завершення = результати (всі типи) за сьогодні
            Promise.all([
                TestResult.countDocuments({ completedAt: { $gte: todayStart } }),
                GameResult.countDocuments({ completedAt: { $gte: todayStart } }),
                QuizResult.countDocuments({ completedAt: { $gte: todayStart } }),
                ComplexTestResult.countDocuments({ completedAt: { $gte: todayStart } })
            ]).then(counts => counts.reduce((a, b) => a + b, 0)),

            Promise.all([
                TestResult.countDocuments({ completedAt: { $gte: weekStart } }),
                GameResult.countDocuments({ completedAt: { $gte: weekStart } }),
                QuizResult.countDocuments({ completedAt: { $gte: weekStart } }),
                ComplexTestResult.countDocuments({ completedAt: { $gte: weekStart } })
            ]).then(counts => counts.reduce((a, b) => a + b, 0)),

            Promise.all([
                TestResult.countDocuments({ completedAt: { $gte: monthStart } }),
                GameResult.countDocuments({ completedAt: { $gte: monthStart } }),
                QuizResult.countDocuments({ completedAt: { $gte: monthStart } }),
                ComplexTestResult.countDocuments({ completedAt: { $gte: monthStart } })
            ]).then(counts => counts.reduce((a, b) => a + b, 0))
        ]);

        const conversionToday = viewsToday > 0 ? Math.round((completionsToday / viewsToday) * 100) : 0;
        const conversionMonth = viewsMonth > 0 ? Math.round((completionsMonth / viewsMonth) * 100) : 0;

        // Активних тестів (не використаних посилань)
        const [activeDeskTests, activeGameLinks, activeQuizLinks] = await Promise.all([
            DeskTest.countDocuments({ isUsed: false }),
            GameLink.countDocuments({ isUsed: false, isActive: true }),
            QuizLink.countDocuments({ isUsed: false })
        ]);
        const activeTests = activeDeskTests + activeGameLinks + activeQuizLinks;

        res.json({
            views: { today: viewsToday, week: viewsWeek, month: viewsMonth, total: viewsTotal },
            completions: { today: completionsToday, week: completionsWeek, month: completionsMonth },
            conversion: { today: conversionToday, month: conversionMonth },
            activeTests
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/traffic — трафік по днях і типах
router.get('/traffic', analyticsAuth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const since = startOf(days);

        // Відвідування по днях
        const dailyViews = await PageView.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    views: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        // Завершення по днях (з усіх результатів)
        const [testByDay, gameByDay, quizByDay, complexByDay] = await Promise.all([
            TestResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } }
            ]),
            GameResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } }
            ]),
            QuizResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } }
            ]),
            ComplexTestResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } }
            ])
        ]);

        // Об'єднуємо завершення по днях
        const completionsByDay = {};
        [...testByDay, ...gameByDay, ...quizByDay, ...complexByDay].forEach(({ _id, count }) => {
            completionsByDay[_id] = (completionsByDay[_id] || 0) + count;
        });

        // Формуємо масив дат за останні N днів
        const chartData = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayView = dailyViews.find(v => v._id.date === dateStr);
            chartData.push({
                date: dateStr,
                views: dayView ? dayView.views : 0,
                completions: completionsByDay[dateStr] || 0
            });
        }

        // Розподіл по типах тестів
        const byType = await PageView.aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: '$testType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Топ міст
        const byCityRaw = await PageView.aggregate([
            { $match: { createdAt: { $gte: since }, city: { $ne: '' } } },
            { $group: { _id: '$city', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);
        const byCity = byCityRaw.map(c => ({ city: c._id, count: c.count }));

        res.json({ chartData, byType, byCity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/tests — топ тестів по відвідуваннях
router.get('/tests', analyticsAuth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const since = startOf(days);

        const topHashes = await PageView.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { hash: '$hash', testType: '$testType', city: '$city', ownerId: '$ownerId' },
                    views: { $sum: 1 },
                    lastSeen: { $max: '$createdAt' }
                }
            },
            { $sort: { views: -1 } },
            { $limit: 20 }
        ]);

        // Рахуємо завершення по хешам
        const hashes = topHashes.map(t => t._id.hash);

        const [testCompletions, gameCompletions, quizCompletions] = await Promise.all([
            TestResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: null, count: { $sum: 1 } } }
            ]),
            GameResult.aggregate([
                { $match: { hash: { $in: hashes }, completedAt: { $gte: since } } },
                { $group: { _id: '$hash', count: { $sum: 1 } } }
            ]),
            QuizResult.aggregate([
                { $match: { completedAt: { $gte: since } } },
                { $group: { _id: null, count: { $sum: 1 } } }
            ])
        ]);

        const gameMap = {};
        gameCompletions.forEach(({ _id, count }) => { gameMap[_id] = count; });

        const result = topHashes.map(t => ({
            hash: t._id.hash,
            testType: t._id.testType,
            city: t._id.city,
            views: t.views,
            completions: gameMap[t._id.hash] || 0,
            conversion: t.views > 0 ? Math.round(((gameMap[t._id.hash] || 0) / t.views) * 100) : 0,
            lastSeen: t.lastSeen
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
