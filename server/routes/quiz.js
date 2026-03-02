const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const QuizLink = require('../models/QuizLink');
const { auth } = require('../middleware/authMiddleware');

// Admin: Get all quizzes
router.get('/', auth, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'superadmin') {
            query = {
                $or: [
                    { ownerId: req.user._id },
                    { targetCity: req.user.city, targetCity: { $ne: '' } }
                ]
            };
        }
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

// Admin: Create quiz link
router.post('/links', auth, async (req, res) => {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ error: 'quizId is required' });
    try {
        const hash = crypto.randomBytes(16).toString('hex');
        const link = new QuizLink({
            quizId,
            hash,
            ownerId: req.user._id
        });
        await link.save();
        res.status(201).json(link);
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
        const link = await QuizLink.findOne({ hash: req.params.hash })
            .populate('quizId')
            .populate('ownerId', 'city');
        if (!link) return res.status(404).json({ error: 'Quiz link not found' });
        if (link.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

        const quiz = link.quizId.toObject();
        quiz.city = quiz.targetCity || (link.ownerId ? link.ownerId.city : '');
        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Submit quiz
router.post('/hash/:hash/submit', async (req, res) => {
    try {
        const link = await QuizLink.findOne({ hash: req.params.hash }).populate('quizId');
        if (!link) return res.status(404).json({ error: 'Quiz link not found' });
        if (link.isUsed) return res.status(410).json({ error: 'Цей тест вже пройдено' });

        link.isUsed = true;
        await link.save();

        const quiz = link.quizId;
        const { studentName, studentLastName, studentCity, studentPosition, answers } = req.body;
        let score = 0;

        const detailedAnswers = quiz.questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.correctIndex;
            if (isCorrect) score++;
            return {
                questionText: q.text,
                givenAnswer: q.options[answers[idx]] || '—',
                correctAnswer: q.options[q.correctIndex],
                explanation: q.explanation,
                isCorrect
            };
        });

        const result = new QuizResult({
            quizId: quiz._id,
            ownerId: quiz.ownerId,
            studentName,
            studentLastName,
            studentCity,
            studentPosition: String(studentPosition || '').trim(),
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
