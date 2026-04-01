const express = require('express');
const router = express.Router();
const ComplexTest = require('../models/ComplexTest');
const ComplexTestResult = require('../models/ComplexTestResult');
const DeskTemplate = require('../models/DeskTemplate');
const GameScenario = require('../models/GameScenario');
const Quiz = require('../models/Quiz');
const PageView = require('../models/PageView');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { validateDeskPlacement } = require('../utils/scoring');
const { buildBaseFilter, buildOwnerQuery, buildResultFilter } = require('../utils/platformFilter');
const { DESK_EDITOR_ROLES, RESULT_VIEW_ROLES, RESULT_EDIT_ROLES } = require('../utils/accessPolicy');
const { getBindingCity, assertCityBinding } = require('../utils/publicCityBinding');
const { buildPublicDeskTemplate } = require('../utils/publicDeskPayload');

const crypto = require('crypto');
const ComplexTestLink = require('../models/ComplexTestLink');
const complexEditorAuth = [auth, checkRole(DESK_EDITOR_ROLES)];

// ── Admin: CRUD ──────────────────────────────────────────────────────────────

// Get all complex tests (platform-scoped)
router.get('/', complexEditorAuth, async (req, res) => {
    try {
        const query = buildBaseFilter(req.user, 'targetCity');
        const tests = await ComplexTest.find(query).sort({ createdAt: -1 });
        res.json(tests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create complex test
router.post('/', complexEditorAuth, async (req, res) => {
    const { title, steps } = req.body;
    if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Назва тесту є обов\'язковою' });
    }
    if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Тест повинен мати хоча б один крок' });
    }
    try {
        const test = new ComplexTest({
            ...req.body,
            ownerId: req.user._id,
            platform: req.user.platform || ''
        });
        await test.save();
        res.status(201).json(test);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Create complex test link
router.post('/links', complexEditorAuth, async (req, res) => {
    const { complexTestId } = req.body;
    if (!complexTestId) return res.status(400).json({ error: 'complexTestId is required' });
    try {
        const ownerQuery = buildOwnerQuery(req.user, complexTestId);
        const complexTest = await ComplexTest.findOne(ownerQuery);
        if (!complexTest) {
            return res.status(403).json({ error: 'РўРµСЃС‚ РЅРµ Р·РЅР°Р№РґРµРЅРѕ Р°Р±Рѕ РЅРµРјР°С” РґРѕСЃС‚СѓРїСѓ' });
        }

        const hash = crypto.randomBytes(16).toString('hex');
        const link = new ComplexTestLink({
            complexTestId,
            hash,
            ownerId: req.user._id,
            targetCity: getBindingCity(complexTest.targetCity)
        });
        await link.save();
        res.status(201).json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update complex test
router.put('/:id', complexEditorAuth, async (req, res) => {
    try {
        const query = buildOwnerQuery(req.user, req.params.id);
        const test = await ComplexTest.findOneAndUpdate(query, req.body, { new: true, runValidators: true });
        if (!test) return res.status(404).json({ error: 'Тест не знайдено або немає доступу' });
        res.json(test);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete complex test
router.delete('/:id', complexEditorAuth, async (req, res) => {
    try {
        const query = buildOwnerQuery(req.user, req.params.id);
        const test = await ComplexTest.findOneAndDelete(query);
        if (!test) return res.status(404).json({ error: 'Тест не знайдено або немає доступу' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Admin: get available items for step creation ─────────────────────────────

router.get('/available-items', complexEditorAuth, async (req, res) => {
    try {
        const ownerQuery = buildBaseFilter(req.user, 'targetCity');
        const [templates, scenarios, quizzes] = await Promise.all([
            DeskTemplate.find(ownerQuery, 'templateName timeLimit items').sort({ createdAt: -1 }),
            GameScenario.find(ownerQuery, 'title description').sort({ createdAt: -1 }),
            Quiz.find(ownerQuery, 'title timeLimit questions').sort({ createdAt: -1 })
        ]);
        res.json({ templates, scenarios, quizzes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Public: student access ───────────────────────────────────────────────────

// Get complex test by hash
router.get('/hash/:hash', async (req, res) => {
    try {
        const link = await ComplexTestLink.findOne({ hash: req.params.hash })
            .populate('complexTestId')
            .populate('ownerId', 'city');
        if (!link) return res.status(404).json({ error: 'Тест не знайдено' });
        if (link.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

        const test = link.complexTestId;
        // Populate step refs based on type
        const populatedSteps = await Promise.all(test.steps.map(async (step, stepIndex) => {
            const stepObj = step.toObject ? step.toObject() : { ...step };
            try {
                if (step.type === 'desk') {
                    const tmpl = await DeskTemplate.findById(step.refId);
                    if (tmpl) {
                        stepObj.refData = buildPublicDeskTemplate(tmpl);
                    }
                } else if (step.type === 'game') {
                    stepObj.refData = await GameScenario.findById(step.refId);
                } else if (step.type === 'quiz') {
                    const quiz = await Quiz.findById(step.refId);
                    if (quiz) {
                        const q = quiz.toObject();
                        const attempt = (link.quizAttempts || []).find((entry) => entry.stepIndex === stepIndex);
                        q.attemptProgress = attempt?.answers?.length || 0;
                        q.attemptAnswers = (attempt?.answers || []).map(({ questionIndex, answerIndex, isCorrect }) => ({
                            questionIndex,
                            answerIndex,
                            isCorrect
                        }));
                        // Strip correct answers
                        q.questions = q.questions.map(({ correctIndex, explanation, ...rest }) => rest);
                        stepObj.refData = q;
                    }
                }
            } catch (e) {
                stepObj.refData = null;
            }
            return stepObj;
        }));

        const bindingCity = getBindingCity(link.targetCity, test.targetCity);
        const city = bindingCity || (link.ownerId ? link.ownerId.city : '');

        // Трекінг відвідування
        PageView.create({
            testType: 'complex',
            hash: req.params.hash,
            ownerId: link.ownerId,
            city,
            ip: req.ip || req.headers['x-forwarded-for'] || ''
        }).catch(() => { });

        res.json({
            _id: test._id,
            title: test.title,
            description: test.description,
            hash: link.hash,
            steps: populatedSteps,
            city,
            cityBindingEnabled: Boolean(bindingCity),
            cityBindingTarget: bindingCity
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check single quiz answer within a complex test step
router.post('/check-quiz-answer', async (req, res) => {
    const { hash, stepIndex, questionIndex, answerIndex } = req.body;
    if (hash == null || stepIndex == null || questionIndex == null || answerIndex == null) {
        return res.status(400).json({ error: 'hash, stepIndex, questionIndex, answerIndex required' });
    }
    try {
        const link = await ComplexTestLink.findOne({ hash }).populate('complexTestId');
        if (!link) return res.status(404).json({ error: 'Тест не знайдено' });

        if (link.isUsed) return res.status(410).json({ error: 'Р¦РµР№ С‚РµСЃС‚ РІР¶Рµ РїСЂРѕР№РґРµРЅРѕ' });

        const normalizedStepIndex = Number(stepIndex);
        const normalizedQuestionIndex = Number(questionIndex);
        const normalizedAnswerIndex = Number(answerIndex);

        if (!Number.isInteger(normalizedStepIndex) || !Number.isInteger(normalizedQuestionIndex) || !Number.isInteger(normalizedAnswerIndex)) {
            return res.status(400).json({ error: 'stepIndex, questionIndex and answerIndex must be integers' });
        }

        const step = link.complexTestId.steps[normalizedStepIndex];
        if (!step || step.type !== 'quiz') return res.status(400).json({ error: 'Invalid step' });

        const quiz = await Quiz.findById(step.refId);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        const q = quiz.questions[normalizedQuestionIndex];
        if (!q) return res.status(400).json({ error: 'Invalid questionIndex' });

        if (!Array.isArray(link.quizAttempts)) {
            link.quizAttempts = [];
        }

        let stepAttempt = link.quizAttempts.find((entry) => entry.stepIndex === normalizedStepIndex);
        if (!stepAttempt) {
            link.quizAttempts.push({ stepIndex: normalizedStepIndex, answers: [] });
            stepAttempt = link.quizAttempts[link.quizAttempts.length - 1];
        }

        const existingAttempt = (stepAttempt.answers || []).find((entry) => entry.questionIndex === normalizedQuestionIndex);
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

        const expectedQuestionIndex = (stepAttempt.answers || []).length;
        if (normalizedQuestionIndex !== expectedQuestionIndex) {
            return res.status(409).json({ error: 'РџРёС‚Р°РЅРЅСЏ С‚СЂРµР±Р° РїРѕСЃР»С–РґРѕРІРЅРѕ' });
        }

        const isCorrect = normalizedAnswerIndex === q.correctIndex;
        stepAttempt.answers.push({
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

// Check desk step — server-side scoring for complex test
router.post('/check-desk-step', async (req, res) => {
    const { hash, stepIndex, items } = req.body;
    if (hash == null || stepIndex == null || !Array.isArray(items)) {
        return res.status(400).json({ error: 'hash, stepIndex, items required' });
    }
    try {
        const link = await ComplexTestLink.findOne({ hash }).populate('complexTestId');
        if (!link) return res.status(404).json({ error: 'Тест не знайдено' });

        const step = link.complexTestId.steps[stepIndex];
        if (!step || step.type !== 'desk') return res.status(400).json({ error: 'Invalid step' });

        const template = await DeskTemplate.findById(step.refId);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        const targetItems = template.items;
        const result = validateDeskPlacement(items, targetItems);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit complex test result
router.post('/hash/:hash/submit', async (req, res) => {
    const { studentName, studentLastName, studentCity, studentPosition, steps } = req.body;
    if (!studentName || !studentLastName || !studentCity) {
        return res.status(400).json({ error: 'Дані студента є обов\'язковими' });
    }
    if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Результати кроків є обов\'язковими' });
    }
    try {
        const link = await ComplexTestLink.findOne({ hash: req.params.hash });
        if (!link) return res.status(404).json({ error: 'Тест не знайдено' });
        if (link.isUsed) return res.status(410).json({ error: 'Цей тест вже пройдено' });

        const testId = link.complexTestId;
        const test = await ComplexTest.findById(testId);
        assertCityBinding(getBindingCity(link.targetCity, test?.targetCity), studentCity, 'посилання');

        const overallPassed = steps.every(s => s.passed);

        const result = new ComplexTestResult({
            complexTestId: test._id,
            ownerId: test.ownerId,
            studentName: String(studentName).trim(),
            studentLastName: String(studentLastName).trim(),
            studentCity: String(studentCity).trim(),
            studentPosition: String(studentPosition || '').trim(),
            steps,
            overallPassed
        });
        await result.save();

        // Sync student stats and emit real-time event
        await syncStudent(result.studentName, result.studentLastName, result.studentCity, req.app.get('io'), result);
        link.isUsed = true;
        await link.save();
        res.status(201).json(result);
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

// Admin: Get results (platform-scoped)
router.get('/results', auth, checkRole(RESULT_VIEW_ROLES), async (req, res) => {
    try {
        const query = await buildResultFilter(req.user, 'studentCity');
        const results = await ComplexTestResult.find(query)
            .populate('complexTestId', 'title')
            .sort({ completedAt: -1 });
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
        const query = await buildResultFilter(req.user, 'studentCity');
        query._id = req.params.id;
        const result = await ComplexTestResult.findOneAndUpdate(
            query,
            { studentCity: city.trim() },
            { new: true }
        ).populate('complexTestId', 'title');
        if (!result) return res.status(404).json({ error: 'Результат не знайдено' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
