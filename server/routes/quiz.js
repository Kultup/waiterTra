const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const QuizLink = require('../models/QuizLink');
const PageView = require('../models/PageView');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { buildBaseFilter, buildOwnerQuery } = require('../utils/platformFilter');
const { SCENARIO_EDITOR_ROLES, RESULT_VIEW_ROLES, RESULT_EDIT_ROLES } = require('../utils/accessPolicy');
const { getBindingCity, assertCityBinding } = require('../utils/publicCityBinding');

const DEFAULT_TIME_LIMIT = 300;
const DEFAULT_PASSING_SCORE = 70;
const MAX_TIME_LIMIT = 1440;
const quizEditorAuth = [auth, checkRole(SCENARIO_EDITOR_ROLES)];

const createValidationError = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
};

const normalizeSubmittedAnswers = (answers) => {
    if (Array.isArray(answers)) {
        return answers;
    }
    if (!answers || typeof answers !== 'object') {
        return [];
    }

    return Object.keys(answers)
        .sort((left, right) => Number(left) - Number(right))
        .reduce((accumulator, key) => {
            accumulator[Number(key)] = answers[key];
            return accumulator;
        }, []);
};

const normalizeQuestion = (question, questionIndex) => {
    const questionNumber = questionIndex + 1;
    const text = String(question?.text || '').trim();
    if (!text) {
        throw createValidationError(`Питання #${questionNumber} має містити текст`);
    }

    const options = (Array.isArray(question?.options) ? question.options : [])
        .map((option) => String(option || '').trim())
        .filter(Boolean);

    if (options.length < 2) {
        throw createValidationError(`Питання #${questionNumber} має містити щонайменше 2 варіанти відповіді`);
    }

    const correctIndex = Number(question?.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        throw createValidationError(`Питання #${questionNumber} має коректно заповнений правильний варіант`);
    }

    return {
        text,
        options,
        correctIndex,
        image: String(question?.image || '').trim(),
        video: String(question?.video || '').trim(),
        explanation: String(question?.explanation || '').trim()
    };
};

const normalizeQuestions = (questions) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw createValidationError('Квіз повинен мати хоча б одне питання');
    }

    return questions.map((question, questionIndex) => normalizeQuestion(question, questionIndex));
};

const normalizeTimeLimit = (timeLimit, fallback = DEFAULT_TIME_LIMIT) => {
    if (timeLimit === undefined || timeLimit === null || timeLimit === '') {
        return fallback;
    }

    const normalizedTimeLimit = Number(timeLimit);
    if (!Number.isFinite(normalizedTimeLimit) || normalizedTimeLimit < 0 || normalizedTimeLimit > MAX_TIME_LIMIT) {
        throw createValidationError(`Час на проходження має бути від 0 до ${MAX_TIME_LIMIT} хвилин`);
    }

    return normalizedTimeLimit;
};

const normalizePassingScore = (passingScore, fallback = DEFAULT_PASSING_SCORE) => {
    if (passingScore === undefined || passingScore === null || passingScore === '') {
        return fallback;
    }

    const normalizedPassingScore = Number(passingScore);
    if (!Number.isFinite(normalizedPassingScore) || normalizedPassingScore < 0 || normalizedPassingScore > 100) {
        throw createValidationError('Прохідний бал має бути в межах від 0 до 100');
    }

    return normalizedPassingScore;
};

// Admin: Get all quizzes (platform-scoped)
router.get('/', quizEditorAuth, async (req, res) => {
    try {
        const query = buildBaseFilter(req.user, 'city');
        const quizzes = await Quiz.find(query).sort({ createdAt: -1 });
        res.json(quizzes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create quiz
router.post('/', quizEditorAuth, async (req, res) => {
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

        const sanitizedQuestions = normalizeQuestions(questions);
        const normalizedCity = String(targetCity || city || '').trim();

        const quiz = new Quiz({
            title: title.trim(),
            description: String(description || '').trim(),
            city: normalizedCity,
            questions: sanitizedQuestions,
            timeLimit: normalizeTimeLimit(timeLimit),
            passingScore: normalizePassingScore(passingScore),
            hash,
            isActive: true,
            ownerId: req.user._id,
            platform: req.user.platform || ''
        });
        await quiz.save();
        console.log('Quiz created:', quiz._id);
        res.json(quiz);
    } catch (err) {
        if (!err.status || err.status >= 500) {
            console.error('Error creating quiz:', err);
        }
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Admin: Create quiz link
router.post('/links', quizEditorAuth, async (req, res) => {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ error: 'quizId is required' });
    try {
        // Перевіряємо що квіз належить цьому користувачу або він superadmin
        const ownerQuery = buildOwnerQuery(req.user, quizId);
        const quiz = await Quiz.findOne(ownerQuery);
        if (!quiz) return res.status(403).json({ error: 'Квіз не знайдено або немає доступу' });

        const hash = crypto.randomBytes(16).toString('hex');
        const link = new QuizLink({
            quizId,
            hash,
            ownerId: req.user._id,
            targetCity: getBindingCity(quiz.city)
        });
        await link.save();
        res.status(201).json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Update quiz
router.put('/:id', quizEditorAuth, async (req, res) => {
    try {
        const query = buildOwnerQuery(req.user, req.params.id);
        const updateData = { ...req.body };

        if (updateData.title !== undefined) {
            updateData.title = String(updateData.title || '').trim();
            if (!updateData.title) {
                return res.status(400).json({ error: 'РќР°Р·РІР° РєРІС–Р·Сѓ С” РѕР±РѕРІ\'СЏР·РєРѕРІРѕСЋ' });
            }
        }

        if (updateData.description !== undefined) {
            updateData.description = String(updateData.description || '').trim();
        }

        if (updateData.targetCity !== undefined) {
            updateData.city = String(updateData.targetCity || '').trim();
            delete updateData.targetCity;
        } else if (updateData.city !== undefined) {
            updateData.city = String(updateData.city || '').trim();
        }
        if (Array.isArray(updateData.questions)) {
            updateData.questions = normalizeQuestions(updateData.questions);
        }
        if (updateData.timeLimit !== undefined) {
            updateData.timeLimit = normalizeTimeLimit(updateData.timeLimit);
        }
        if (updateData.passingScore !== undefined) {
            updateData.passingScore = normalizePassingScore(updateData.passingScore);
        }
        const quiz = await Quiz.findOneAndUpdate(query, updateData, { new: true });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found or unauthorized' });
        res.json(quiz);
    } catch (err) {
        if (!err.status || err.status >= 500) {
            console.error('Error updating quiz:', err);
        }
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Admin: Delete quiz
router.delete('/:id', quizEditorAuth, async (req, res) => {
    try {
        const query = buildOwnerQuery(req.user, req.params.id);
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
        const bindingCity = getBindingCity(link.targetCity, quiz.city);
        quiz.city = bindingCity || (link.ownerId ? link.ownerId.city : '');
        quiz.cityBindingEnabled = Boolean(bindingCity);
        quiz.cityBindingTarget = bindingCity;
        quiz.attemptProgress = Array.isArray(link.attemptAnswers) ? link.attemptAnswers.length : 0;
        quiz.attemptAnswers = (link.attemptAnswers || []).map(({ questionIndex, answerIndex, isCorrect }) => ({
            questionIndex,
            answerIndex,
            isCorrect
        }));

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
        if (link.isUsed) return res.status(410).json({ error: 'Р¦РµР№ С‚РµСЃС‚ РІР¶Рµ РїСЂРѕР№РґРµРЅРѕ' });

        const quiz = link.quizId;
        const normalizedQuestionIndex = Number(questionIndex);
        const normalizedAnswerIndex = Number(answerIndex);

        if (!Number.isInteger(normalizedQuestionIndex) || !Number.isInteger(normalizedAnswerIndex)) {
            return res.status(400).json({ error: 'questionIndex and answerIndex must be integers' });
        }

        const q = quiz.questions[normalizedQuestionIndex];
        if (!q) return res.status(400).json({ error: 'Invalid questionIndex' });

        const attemptAnswers = Array.isArray(link.attemptAnswers) ? link.attemptAnswers : [];
        const existingAttempt = attemptAnswers.find((entry) => entry.questionIndex === normalizedQuestionIndex);

        if (existingAttempt) {
            if (existingAttempt.answerIndex !== normalizedAnswerIndex) {
                return res.status(409).json({ error: 'Р’С–РґРїРѕРІС–РґСЊ РЅР° С†Рµ РїРёС‚Р°РЅРЅСЏ РІР¶Рµ Р·Р±РµСЂРµР¶РµРЅР°' });
            }

            return res.json({
                isCorrect: existingAttempt.isCorrect,
                correctIndex: q.correctIndex,
                explanation: !existingAttempt.isCorrect ? (q.explanation || null) : null,
                alreadyAnswered: true
            });
        }

        const expectedQuestionIndex = attemptAnswers.length;
        if (normalizedQuestionIndex !== expectedQuestionIndex) {
            return res.status(409).json({ error: 'РџРёС‚Р°РЅРЅСЏ С‚СЂРµР±Р° РїСЂРѕС…РѕРґРёС‚Рё РїРѕСЃР»С–РґРѕРІРЅРѕ' });
        }

        const isCorrect = normalizedAnswerIndex === q.correctIndex;
        link.attemptAnswers.push({
            questionIndex: normalizedQuestionIndex,
            answerIndex: normalizedAnswerIndex,
            isCorrect
        });
        await link.save();

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

        assertCityBinding(getBindingCity(link.targetCity, quiz.city), studentCity, 'посилання');

        let score = 0;
        const storedAttemptAnswers = Array.isArray(link.attemptAnswers) ? link.attemptAnswers : [];
        const answersArray = storedAttemptAnswers.length > 0
            ? storedAttemptAnswers.reduce((accumulator, entry) => {
                accumulator[entry.questionIndex] = entry.answerIndex;
                return accumulator;
            }, [])
            : normalizeSubmittedAnswers(answers);

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
        link.attemptAnswers = [];
        await link.save();

        console.log('Quiz result saved:', result._id);
        res.json(result);
    } catch (err) {
        console.error('Error submitting quiz:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Get all results (platform-scoped)
router.get('/results', auth, checkRole(RESULT_VIEW_ROLES), async (req, res) => {
    try {
        const { buildResultFilter } = require('../utils/platformFilter');
        const query = await buildResultFilter(req.user, 'studentCity');
        const results = await QuizResult.find(query).populate('quizId', 'title').sort({ completedAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH city
router.patch('/results/:id/city', auth, checkRole(RESULT_EDIT_ROLES), async (req, res) => {
    try {
        if (!['superadmin', 'admin', 'trainer'].includes(req.user.role))
            return res.status(403).json({ error: 'Немає доступу' });
        const { city } = req.body;
        if (!city || !city.trim()) return res.status(400).json({ error: 'Місто обов\'язкове' });
        const { buildResultFilter } = require('../utils/platformFilter');
        const query = await buildResultFilter(req.user, 'studentCity');
        query._id = req.params.id;
        const result = await QuizResult.findOneAndUpdate(
            query,
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
