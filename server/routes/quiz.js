const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const { auth } = require('../middleware/authMiddleware');

// Admin: Get all quizzes
router.get('/', auth, async (req, res) => {
    try {
        const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
        const quizzes = await Quiz.find(query).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create quiz
router.post('/', auth, async (req, res) => {
    try {
        const quiz = new Quiz({
            ...req.body,
            ownerId: req.user._id
        });
        await quiz.save();
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update quiz
router.put('/:id', auth, async (req, res) => {
    try {
        const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
        const quiz = await Quiz.findOneAndUpdate(query, req.body, { new: true });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found or unauthorized' });
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete quiz
router.delete('/:id', auth, async (req, res) => {
    try {
        const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
        const quiz = await Quiz.findOneAndDelete(query);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found or unauthorized' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Get quiz by hash
router.get('/hash/:hash', async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ hash: req.params.hash });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Submit quiz
router.post('/hash/:hash/submit', async (req, res) => {
    try {
        const quiz = await Quiz.findOne({ hash: req.params.hash });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        const { studentName, studentLastName, studentCity, answers } = req.body;
        let score = 0;

        const detailedAnswers = quiz.questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.correctIndex;
            if (isCorrect) score++;
            return {
                questionText: q.text,
                givenAnswer: q.options[answers[idx]] || '—',
                correctAnswer: q.options[q.correctIndex],
                isCorrect
            };
        });

        const result = new QuizResult({
            quizId: quiz._id,
            ownerId: quiz.ownerId,
            studentName,
            studentLastName,
            studentCity,
            score,
            total: quiz.questions.length,
            percentage: Math.round((score / quiz.questions.length) * 100),
            answers: detailedAnswers
        });

        await result.save();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all results
router.get('/results', auth, async (req, res) => {
    try {
        const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
        const results = await QuizResult.find(query).populate('quizId', 'title').sort({ completedAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
