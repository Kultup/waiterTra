const express = require('express');
const router = express.Router();
const ComplexTest = require('../models/ComplexTest');
const ComplexTestResult = require('../models/ComplexTestResult');
const DeskTemplate = require('../models/DeskTemplate');
const GameScenario = require('../models/GameScenario');
const Quiz = require('../models/Quiz');
const PageView = require('../models/PageView');
const { auth } = require('../middleware/authMiddleware');

const crypto = require('crypto');
const ComplexTestLink = require('../models/ComplexTestLink');

// ── Admin: CRUD ──────────────────────────────────────────────────────────────

// Get all complex tests
router.get('/', auth, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'superadmin') {
            query = {
                $or: [
                    { ownerId: req.user._id },
                    { targetCity: req.user.city }
                ]
            };
            // Ensure we don't match empty targetCity if req.user.city is empty (though admins should have a city)
            if (!req.user.city) {
                query.$or = [{ ownerId: req.user._id }];
            }
        }
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
            ownerId: req.user._id
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
        const query = req.user.role === 'superadmin'
            ? { _id: req.params.id }
            : { _id: req.params.id, ownerId: req.user._id };
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
        const query = req.user.role === 'superadmin'
            ? { _id: req.params.id }
            : { _id: req.params.id, ownerId: req.user._id };
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
        const ownerQuery = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
        const [templates, scenarios, quizzes] = await Promise.all([
            DeskTemplate.find(ownerQuery, 'name timeLimit items').sort({ createdAt: -1 }),
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
                    stepObj.refData = await DeskTemplate.findById(step.refId);
                } else if (step.type === 'game') {
                    stepObj.refData = await GameScenario.findById(step.refId);
                } else if (step.type === 'quiz') {
                    stepObj.refData = await Quiz.findById(step.refId);
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
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Admin: Get results
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
        const results = await ComplexTestResult.find(query)
            .populate('complexTestId', 'title')
            .sort({ completedAt: -1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
