const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const {
    parseStudentKey,
    buildStudentSummary,
    buildStudentSummaries,
    fetchAccessibleStudentHistory
} = require('../utils/studentAccess');

const STUDENT_MANAGER_ROLES = ['superadmin', 'admin'];

// GET /api/students - Get all accessible students derived from accessible results
router.get('/', auth, checkRole(STUDENT_MANAGER_ROLES), async (req, res) => {
    try {
        const history = await fetchAccessibleStudentHistory(req.user);
        const students = buildStudentSummaries(history);
        res.json(students);
    } catch (err) {
        logger.error('Error fetching students:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/students/:id - Get student profile and history
router.get('/:id', auth, checkRole(STUDENT_MANAGER_ROLES), async (req, res) => {
    try {
        const studentIdentity = parseStudentKey(req.params.id);
        if (!studentIdentity) {
            return res.status(404).json({ error: 'Студента не знайдено' });
        }

        const history = await fetchAccessibleStudentHistory(req.user, {
            identity: studentIdentity,
            includeRelations: true
        });

        const student = buildStudentSummary(history);
        if (!student) {
            return res.status(404).json({ error: 'Студента не знайдено' });
        }

        res.json({
            student,
            history
        });
    } catch (err) {
        logger.error('Error fetching student profile:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
