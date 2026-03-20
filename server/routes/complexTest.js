const express = require('express');
const router = express.Router();
const ComplexTest = require('../models/ComplexTest');
const ComplexTestResult = require('../models/ComplexTestResult');
const DeskTemplate = require('../models/DeskTemplate');
const GameScenario = require('../models/GameScenario');
const Quiz = require('../models/Quiz');
const PageView = require('../models/PageView');
const { auth } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { buildBaseFilter, buildOwnerQuery, buildResultFilter } = require('../utils/platformFilter');

const crypto = require('crypto');
const ComplexTestLink = require('../models/ComplexTestLink');

// ── Admin: CRUD ──────────────────────────────────────────────────────────────

// Get all complex tests (platform-scoped)
router.get('/', auth, async (req, res) => {
    try {
        const query = buildBaseFilter(req.user, 'targetCity');
        const tests = await ComplexTest.find(query).sort({ createdAt: -1 });
        res.json(tests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create complex test
router.post('/', auth, async (req, res) => {
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
router.post('/links', auth, async (req, res) => {
    const { complexTestId } = req.body;
    if (!complexTestId) return res.status(400).json({ error: 'complexTestId is required' });
    try {
        const hash = crypto.randomBytes(16).toString('hex');
        const link = new ComplexTestLink({
            complexTestId,
            hash,
            ownerId: req.user._id
        });
        await link.save();
        res.status(201).json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update complex test
router.put('/:id', auth, async (req, res) => {
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
router.delete('/:id', auth, async (req, res) => {
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

router.get('/available-items', auth, async (req, res) => {
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
        const populatedSteps = await Promise.all(test.steps.map(async (step) => {
            const stepObj = step.toObject ? step.toObject() : { ...step };
            try {
                if (step.type === 'desk') {
                    const tmpl = await DeskTemplate.findById(step.refId);
                    if (tmpl) {
                        // Strip target item positions — student must not see correct layout
                        const t = tmpl.toObject();
                        delete t.items;
                        stepObj.refData = t;
                    }
                } else if (step.type === 'game') {
                    stepObj.refData = await GameScenario.findById(step.refId);
                } else if (step.type === 'quiz') {
                    const quiz = await Quiz.findById(step.refId);
                    if (quiz) {
                        const q = quiz.toObject();
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

        const city = test.targetCity || (link.ownerId ? link.ownerId.city : '');

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
            city
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

        const step = link.complexTestId.steps[stepIndex];
        if (!step || step.type !== 'quiz') return res.status(400).json({ error: 'Invalid step' });

        const quiz = await Quiz.findById(step.refId);
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

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
        const tolerance = 50;
        let score = 0;

        const validatedItems = items.map(userItem => {
            const correctMatch = targetItems.find(target =>
                userItem.type === target.type &&
                Math.abs(userItem.x - target.x) < tolerance &&
                Math.abs(userItem.y - target.y) < tolerance
            );
            return { ...userItem, isCorrect: !!correctMatch };
        });

        targetItems.forEach(target => {
            const found = items.some(userItem =>
                userItem.type === target.type &&
                Math.abs(userItem.x - target.x) < tolerance &&
                Math.abs(userItem.y - target.y) < tolerance
            );
            if (found) score++;
        });

        const total = targetItems.length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= 80;

        // Return ghost items (correct positions) for overlay
        const ghostItems = targetItems.map(i => ({ type: i.type, name: i.name, icon: i.icon, x: i.x, y: i.y }));

        res.json({ score, total, percentage, passed, validatedItems, ghostItems });
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

        link.isUsed = true;
        await link.save();

        const testId = link.complexTestId;
        const test = await ComplexTest.findById(testId);

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
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Get results (platform-scoped)
router.get('/results', auth, async (req, res) => {
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
router.patch('/results/:id/city', auth, async (req, res) => {
    try {
        if (!['superadmin', 'admin', 'trainer'].includes(req.user.role))
            return res.status(403).json({ error: 'Немає доступу' });
        const { city } = req.body;
        if (!city || !city.trim()) return res.status(400).json({ error: 'Місто обов\'язкове' });
        const result = await ComplexTestResult.findByIdAndUpdate(
            req.params.id,
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
