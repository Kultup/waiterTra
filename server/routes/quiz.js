const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const QuizLink = require('../models/QuizLink');
const PageView = require('../models/PageView');
const { auth } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');

// Admin: Get all quizzes
router.get('/', auth, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'superadmin') {
            const orConditions = [{ ownerId: req.user._id }];
            if (req.user.city) orConditions.push({ city: req.user.city });
            query = { $or: orConditions };
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
        const { title, description, questions, city, targetCity, timeLimit, passingScore } = req.body;

        // Validate required fields
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Назва квізу є обов\'язковою' });
        }
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Квіз повинен мати хоча б одне питання' });
        }

        const hash = crypto.randomBytes(16).toString('hex');

        console.log('Creating quiz:', { title, questionsCount: questions.length, hash });

        const sanitizedQuestions = questions.map(q => ({
            ...q,
            options: (q.options || []).filter(o => o && o.trim() !== '')
        }));

        const quiz = new Quiz({
            title: title.trim(),
            description: description || '',
            city: targetCity || city || '',
            questions: sanitizedQuestions,
            timeLimit: timeLimit || 300,
            passingScore: passingScore || 70,
            hash,
            isActive: true,
            ownerId: req.user._id
        });
        await quiz.save();
        console.log('Quiz created:', quiz._id);
        res.json(quiz);
    } catch (err) {
        console.error('Error creating quiz:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create quiz link
router.post('/links', auth, async (req, res) => {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ error: 'quizId is required' });
    try {
        // Перевіряємо що квіз належить цьому користувачу або він superadmin
        const ownerQuery = req.user.role === 'superadmin'
            ? { _id: quizId }
            : { _id: quizId, ownerId: req.user._id };
        const quiz = await Quiz.findOne(ownerQuery);
        if (!quiz) return res.status(403).json({ error: 'Квіз не знайдено або немає доступу' });

        const hash = crypto.randomBytes(16).toString('hex');
        const link = new QuizLink({ quizId, hash, ownerId: req.user._id });
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
        const updateData = { ...req.body };
        if (updateData.targetCity !== undefined) {
            updateData.city = updateData.targetCity;
            delete updateData.targetCity;
        }
        if (Array.isArray(updateData.questions)) {
            updateData.questions = updateData.questions.map(q => ({
                ...q,
                options: (q.options || []).filter(o => o && o.trim() !== '')
            }));
        }
        const quiz = await Quiz.findOneAndUpdate(query, updateData, { new: true });
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
        quiz.city = quiz.city || (link.ownerId ? link.ownerId.city : '');

        // Трекінг відвідування
        PageView.create({
            testType: 'quiz',
            hash: req.params.hash,
            ownerId: link.ownerId,
            city: quiz.city,
            ip: req.ip || req.headers['x-forwarded-for'] || ''
        }).catch(() => { });

        // Strip correct answers — student must not see them
        quiz.questions = quiz.questions.map(({ correctIndex, explanation, ...rest }) => rest);

        res.json(quiz);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Check single answer (per-question feedback)
router.post('/check-answer', async (req, res) => {
    const { hash, questionIndex, answerIndex } = req.body;
    if (hash == null || questionIndex == null || answerIndex == null) {
        return res.status(400).json({ error: 'hash, questionIndex, answerIndex required' });
    }
    try {
        const link = await QuizLink.findOne({ hash }).populate('quizId');
        if (!link) return res.status(404).json({ error: 'Quiz not found' });

        const quiz = link.quizId;
        const q = quiz.questions[questionIndex];
        if (!q) return res.status(400).json({ error: 'Invalid questionIndex' });

        const isCorrect = answerIndex === q.correctIndex;
        res.json({
            isCorrect,
            correctIndex: q.correctIndex,
            explanation: !isCorrect ? (q.explanation || null) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student: Submit quiz
router.post('/hash/:hash/submit', async (req, res) => {
    try {
        console.log('Submitting quiz:', req.params.hash, req.body);

        const link = await QuizLink.findOne({ hash: req.params.hash }).populate('quizId');
        if (!link) {
            console.error('Quiz link not found:', req.params.hash);
            return res.status(404).json({ error: 'Quiz link not found' });
        }
        if (link.isUsed) {
            console.log('Quiz already used:', req.params.hash);
            return res.status(410).json({ error: 'Цей тест вже пройдено' });
        }

        const quiz = link.quizId;
        const { studentName, studentLastName, studentCity, studentPosition, answers } = req.body;

        if (!studentName || !studentLastName) {
            return res.status(400).json({ error: 'Ім\'я та прізвище обов\'язкові' });
        }

        let score = 0;
        const answersArray = answers || [];

        const detailedAnswers = quiz.questions.map((q, idx) => {
            const givenAnswerIndex = answersArray[idx];
            const isCorrect = givenAnswerIndex === q.correctIndex;
            if (isCorrect) score++;
            return {
                questionText: q.text,
                givenAnswer: q.options[givenAnswerIndex] || '—',
                correctAnswer: q.options[q.correctIndex],
                explanation: q.explanation,
                isCorrect
            };
        });

        const total = quiz.questions.length;
        const percentage = Math.round((score / total) * 100);
        const passed = percentage >= (quiz.passingScore || 70);

        const result = new QuizResult({
            quizId: quiz._id,
            ownerId: quiz.ownerId,
            studentName: String(studentName).trim(),
            studentLastName: String(studentLastName).trim(),
            studentCity: String(studentCity || '').trim(),
            studentPosition: String(studentPosition || '').trim(),
            score,
            total,
            percentage,
            passed,
            answers: detailedAnswers
        });

        await result.save();

        // Sync student stats and emit real-time event
        await syncStudent(studentName, studentLastName, studentCity, req.app.get('io'), result);

        // Mark link as used after successful save
        link.isUsed = true;
        await link.save();

        console.log('Quiz result saved:', result._id);
        res.json(result);
    } catch (err) {
        console.error('Error submitting quiz:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all results
router.get('/results', auth, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'superadmin') {
            query = {};
        } else if (req.user.role === 'viewer') {
            query = req.user.city ? { studentCity: req.user.city } : { _id: null };
        } else {
            // admin/trainer — бачать свої результати АБО результати свого міста
            const orConditions = [{ ownerId: req.user._id }];
            if (req.user.city) orConditions.push({ studentCity: req.user.city });
            query = { $or: orConditions };
        }
        const results = await QuizResult.find(query).populate('quizId', 'title').sort({ completedAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH city
router.patch('/results/:id/city', auth, async (req, res) => {
    try {
        if (!['superadmin', 'admin', 'trainer'].includes(req.user.role))
            return res.status(403).json({ error: 'Немає доступу' });
        const { city } = req.body;
        if (!city || !city.trim()) return res.status(400).json({ error: 'Місто обов\'язкове' });
        const result = await QuizResult.findByIdAndUpdate(
            req.params.id,
            { studentCity: city.trim(), city: city.trim() },
            { new: true }
        ).populate('quizId', 'title');
        if (!result) return res.status(404).json({ error: 'Результат не знайдено' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
