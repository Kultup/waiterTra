const express = require('express');
const router = express.Router();
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const Student = require('../models/Student');
const { auth, adminAuth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// GET /api/maintenance/students - Get unique students list
router.get('/students', auth, async (req, res) => {
    try {
        if (!['superadmin', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Немає доступу' });
        }

        let query = {};
        if (req.user.role === 'admin' && req.user.city) {
            query = { studentCity: req.user.city };
        }

        const students = await Student.find(query).sort({ studentLastName: 1 });
        res.json(students);
    } catch (err) {
        logger.error('Maintenance get students error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/city - Reset all results for a city
router.delete('/reset/city', auth, async (req, res) => {
    const { city } = req.body;
    if (!city) return res.status(400).json({ error: 'Місто є обов\'язковим' });

    try {
        if (!['superadmin', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Немає доступу' });
        }

        // Admins can only reset their own city
        if (req.user.role === 'admin' && req.user.city && req.user.city !== city) {
            return res.status(403).json({ error: 'Ви можете скидати результати тільки свого міста' });
        }

        const results = await Promise.all([
            TestResult.deleteMany({ studentCity: city }),
            GameResult.deleteMany({ city: city }),
            QuizResult.deleteMany({ studentCity: city }),
            ComplexTestResult.deleteMany({ studentCity: city }),
            Student.deleteMany({ studentCity: city })
        ]);

        const count = results.reduce((sum, r) => sum + r.deletedCount, 0);
        logger.info(`Bulk reset for city ${city} by ${req.user.username}. Deleted ${count} records.`);
        
        res.json({ success: true, deletedCount: count });
    } catch (err) {
        logger.error('Maintenance reset city error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/student - Reset all results for a student
router.delete('/reset/student', auth, async (req, res) => {
    const { studentName, studentLastName, studentCity } = req.body;
    if (!studentName || !studentLastName) {
        return res.status(400).json({ error: 'Ім\'я та прізвище обов\'язкові' });
    }

    try {
        if (!['superadmin', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Немає доступу' });
        }

        // Admins can only reset students from their own city
        if (req.user.role === 'admin' && req.user.city && req.user.city !== studentCity) {
            return res.status(403).json({ error: 'Ви можете скидати результати тільки студентів свого міста' });
        }

        const queryGeneral = {
            studentName: studentName.trim(),
            studentLastName: studentLastName.trim(),
            studentCity: studentCity ? studentCity.trim() : ''
        };

        const queryGame = {
            studentName: studentName.trim(),
            studentLastName: studentLastName.trim(),
            city: studentCity ? studentCity.trim() : ''
        };

        const results = await Promise.all([
            TestResult.deleteMany(queryGeneral),
            GameResult.deleteMany(queryGame),
            QuizResult.deleteMany(queryGeneral),
            ComplexTestResult.deleteMany(queryGeneral),
            Student.deleteOne({
                studentName: studentName.trim(),
                studentLastName: studentLastName.trim(),
                studentCity: studentCity ? studentCity.trim() : ''
            })
        ]);

        const count = results.reduce((sum, r) => sum + r.deletedCount, 0);
        logger.info(`Bulk reset for student ${studentLastName} ${studentName} by ${req.user.username}. Deleted ${count} records.`);

        res.json({ success: true, deletedCount: count });
    } catch (err) {
        logger.error('Maintenance reset student error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/all - Reset ALL results in the system (Superadmin only)
router.delete('/reset/all', auth, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Тільки головний адміністратор може виконувати повне скидання' });
        }

        const results = await Promise.all([
            TestResult.deleteMany({}),
            GameResult.deleteMany({}),
            QuizResult.deleteMany({}),
            ComplexTestResult.deleteMany({}),
            Student.deleteMany({})
        ]);

        const count = results.reduce((sum, r) => sum + r.deletedCount, 0);
        logger.warn(`GLOBAL RESET by ${req.user.username}. Deleted ${count} records across all models.`);

        res.json({ success: true, deletedCount: count });
    } catch (err) {
        logger.error('Maintenance global reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
