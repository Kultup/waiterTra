const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const { auth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// GET /api/students - Get all students
router.get('/', auth, async (req, res) => {
    try {
        console.log(`FETCH STUDENTS: user=${req.user.username}, role=${req.user.role}, city=${req.user.city}`);
        let query = {};
        const isGlobalRole = ['superadmin', 'localadmin'].includes(req.user.role);
        
        if (!isGlobalRole) {
            if (req.user.city) {
                query = { studentCity: req.user.city };
            } else {
                // Other roles without a city assigned see nothing
                return res.json([]); 
            }
        }
        
        const students = await Student.find(query).sort({ studentLastName: 1 });
        res.json(students);
    } catch (err) {
        logger.error('Error fetching students:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/students/:id - Get student profile and history
router.get('/:id', auth, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ error: 'Студента не знайдено' });

        // Security check for city-based admins
        if (req.user.role !== 'superadmin') {
            if (!req.user.city || (student.studentCity !== req.user.city && req.user.role !== 'localadmin')) {
                return res.status(403).json({ error: 'Немає доступу до даних цього міста' });
            }
        }

        const query = { 
            studentName: student.studentName, 
            studentLastName: student.studentLastName, 
            studentCity: student.studentCity 
        };

        const [testRes, gameRes, quizRes, complexRes] = await Promise.all([
            TestResult.find(query).sort({ completedAt: -1 }),
            GameResult.find({ studentName: query.studentName, studentLastName: query.studentLastName, city: query.studentCity }).sort({ completedAt: -1 }),
            QuizResult.find(query).populate('quizId', 'title').sort({ completedAt: -1 }),
            ComplexTestResult.find(query).populate('complexTestId', 'title').sort({ completedAt: -1 })
        ]);

        // Combine and sort all results by date
        const history = [
            ...testRes.map(r => ({ ...r.toObject(), type: 'desk' })),
            ...gameRes.map(r => ({ ...r.toObject(), type: 'game' })),
            ...quizRes.map(r => ({ ...r.toObject(), type: 'quiz' })),
            ...complexRes.map(r => ({ ...r.toObject(), type: 'complex' }))
        ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

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
