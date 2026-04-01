const express = require('express');
const router = express.Router();
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const Student = require('../models/Student');
const { auth, checkRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { buildResultFilter } = require('../utils/platformFilter');
const { buildStudentSummaries, normalizeStudentIdentity, buildIdentityQuery, getGameIdentityQuery, fetchAccessibleStudentHistory } = require('../utils/studentAccess');

const MAINTENANCE_ROLES = ['superadmin', 'admin'];

const isGlobalSuperadmin = (user) => user.role === 'superadmin' && !user.platform;

async function deleteScopedResults(user, city) {
    const normalizedCity = String(city || '').trim();
    const testQuery = { ...(await buildResultFilter(user, 'studentCity')), studentCity: normalizedCity };
    const gameQuery = { ...(await buildResultFilter(user, 'city')), city: normalizedCity };
    const quizQuery = { ...(await buildResultFilter(user, 'studentCity')), studentCity: normalizedCity };
    const complexQuery = { ...(await buildResultFilter(user, 'studentCity')), studentCity: normalizedCity };

    return Promise.all([
        TestResult.deleteMany(testQuery),
        GameResult.deleteMany(gameQuery),
        QuizResult.deleteMany(quizQuery),
        ComplexTestResult.deleteMany(complexQuery)
    ]);
}

async function deleteScopedStudentResults(user, identity) {
    const normalizedIdentity = normalizeStudentIdentity(identity);
    const testQuery = { ...(await buildResultFilter(user, 'studentCity')), ...buildIdentityQuery(normalizedIdentity, 'studentCity') };
    const gameQuery = { ...(await buildResultFilter(user, 'city')), ...getGameIdentityQuery(normalizedIdentity) };
    const quizQuery = { ...(await buildResultFilter(user, 'studentCity')), ...buildIdentityQuery(normalizedIdentity, 'studentCity') };
    const complexQuery = { ...(await buildResultFilter(user, 'studentCity')), ...buildIdentityQuery(normalizedIdentity, 'studentCity') };

    return Promise.all([
        TestResult.deleteMany(testQuery),
        GameResult.deleteMany(gameQuery),
        QuizResult.deleteMany(quizQuery),
        ComplexTestResult.deleteMany(complexQuery)
    ]);
}

// GET /api/maintenance/students - Get accessible students list
router.get('/students', auth, checkRole(MAINTENANCE_ROLES), async (req, res) => {
    try {
        const history = await fetchAccessibleStudentHistory(req.user);
        res.json(buildStudentSummaries(history));
    } catch (err) {
        logger.error('Maintenance get students error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/city - Reset all accessible results for a city
router.delete('/reset/city', auth, checkRole(MAINTENANCE_ROLES), async (req, res) => {
    const city = String(req.body?.city || '').trim();
    if (!city) {
        return res.status(400).json({ error: 'Місто є обов\'язковим' });
    }

    try {
        const results = await deleteScopedResults(req.user, city);
        let deletedCount = results.reduce((sum, result) => sum + result.deletedCount, 0);

        if (isGlobalSuperadmin(req.user)) {
            const studentResult = await Student.deleteMany({ studentCity: city });
            deletedCount += studentResult.deletedCount;
        }

        logger.info(`Bulk reset for city ${city} by ${req.user.username}. Deleted ${deletedCount} records.`);
        res.json({ success: true, deletedCount });
    } catch (err) {
        logger.error('Maintenance reset city error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/student - Reset all accessible results for a student
router.delete('/reset/student', auth, checkRole(MAINTENANCE_ROLES), async (req, res) => {
    const identity = normalizeStudentIdentity(req.body);
    if (!identity.studentName || !identity.studentLastName) {
        return res.status(400).json({ error: 'Ім\'я та прізвище обов\'язкові' });
    }

    try {
        const results = await deleteScopedStudentResults(req.user, identity);
        let deletedCount = results.reduce((sum, result) => sum + result.deletedCount, 0);

        if (isGlobalSuperadmin(req.user)) {
            const studentResult = await Student.deleteOne(buildIdentityQuery(identity, 'studentCity'));
            deletedCount += studentResult.deletedCount;
        }

        logger.info(`Bulk reset for student ${identity.studentLastName} ${identity.studentName} by ${req.user.username}. Deleted ${deletedCount} records.`);
        res.json({ success: true, deletedCount });
    } catch (err) {
        logger.error('Maintenance reset student error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/maintenance/reset/all - Reset ALL results in the system (global superadmin only)
router.delete('/reset/all', auth, async (req, res) => {
    try {
        if (!isGlobalSuperadmin(req.user)) {
            return res.status(403).json({ error: 'Тільки головний адміністратор може виконувати повне скидання' });
        }

        const results = await Promise.all([
            TestResult.deleteMany({}),
            GameResult.deleteMany({}),
            QuizResult.deleteMany({}),
            ComplexTestResult.deleteMany({}),
            Student.deleteMany({})
        ]);

        const deletedCount = results.reduce((sum, result) => sum + result.deletedCount, 0);
        logger.warn(`GLOBAL RESET by ${req.user.username}. Deleted ${deletedCount} records across all models.`);

        res.json({ success: true, deletedCount });
    } catch (err) {
        logger.error('Maintenance global reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
