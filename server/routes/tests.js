const express = require('express');
const crypto = require('crypto');
const DeskTest = require('../models/DeskTest');
const MultiDeskTest = require('../models/MultiDeskTest');
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

// ── Multi-desk test (адмін створює, студент проходить) ────────────────────────

// Admin: create multi-desk test
router.post('/multi', auth, async (req, res) => {
  const { templateIds } = req.body;
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({ error: 'templateIds повинен бути непорожнім масивом' });
  }
  try {
    const hash = crypto.randomBytes(8).toString('hex');
    const test = new MultiDeskTest({
      templateIds,
      hash,
      ownerId: req.user._id
    });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Public: get multi-desk test by hash
router.get('/multi/:hash', async (req, res) => {
  try {
    const test = await MultiDeskTest.findOne({ hash: req.params.hash })
      .populate('templateIds');
    if (!test) return res.status(404).json({ error: 'Тест не знайдено' });
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: submit multi-desk test results
router.post('/multi/:hash/submit', async (req, res) => {
  const { studentName, studentLastName, studentCity, results } = req.body;
  if (!studentName || !studentLastName || !studentCity) {
    return res.status(400).json({ error: 'Дані студента є обов\'язковими' });
  }
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'Результати є обов\'язковими' });
  }
  try {
    const test = await MultiDeskTest.findOne({ hash: req.params.hash })
      .populate('templateIds');
    if (!test) return res.status(404).json({ error: 'Тест не знайдено' });

    const tolerance = 50;
    const stepResults = [];

    for (let i = 0; i < test.templateIds.length; i++) {
      const template = test.templateIds[i];
      const userItems = results[i]?.items || [];
      const targetItems = template.items;
      let score = 0;

      targetItems.forEach(target => {
        const found = userItems.some(userItem =>
          userItem.type === target.type &&
          Math.abs(userItem.x - target.x) < tolerance &&
          Math.abs(userItem.y - target.y) < tolerance
        );
        if (found) score++;
      });

      const total = targetItems.length;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      const passed = percentage >= 80;

      stepResults.push({ templateName: template.name, score, total, percentage, passed });

      // Also save individual TestResult
      const result = new TestResult({
        testId: test._id,
        ownerId: test.ownerId,
        templateName: template.name,
        studentName: String(studentName).trim(),
        studentLastName: String(studentLastName).trim(),
        studentCity: String(studentCity).trim(),
        score, total, percentage, passed
      });
      await result.save();
    }

    res.status(201).json({ stepResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Публічні (студент) ────────────────────────────────────────────────────────

// Студент отримує тест за hash (без авторизації)
router.get('/:hash', async (req, res) => {
  try {
    const test = await DeskTest.findOne({ hash: req.params.hash }).populate('templateId');
    if (!test) {
      return res.status(404).json({ error: 'Тест не знайдено' });
    }
    res.json(test);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Студент відправляє відповіді — серверне оцінювання
router.post('/:hash/submit', async (req, res) => {
  const { items, studentName, studentLastName, studentCity } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items повинен бути масивом' });
  }
  if (!studentName || !String(studentName).trim()) {
    return res.status(400).json({ error: 'Ім\'я студента є обов\'язковим' });
  }
  if (!studentLastName || !String(studentLastName).trim()) {
    return res.status(400).json({ error: 'Прізвище студента є обов\'язковим' });
  }
  if (!studentCity || !String(studentCity).trim()) {
    return res.status(400).json({ error: 'Місто студента є обов\'язковим' });
  }

  try {
    const test = await DeskTest.findOne({ hash: req.params.hash }).populate('templateId');
    if (!test) {
      return res.status(404).json({ error: 'Тест не знайдено' });
    }

    const targetItems = test.templateId.items;
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

    const result = new TestResult({
      testId: test._id,
      ownerId: test.ownerId,
      templateName: test.templateId.name,
      studentName: String(studentName).trim(),
      studentLastName: String(studentLastName).trim(),
      studentCity: String(studentCity).trim(),
      score,
      total,
      percentage,
      passed,
      userItems: validatedItems.map(i => ({ type: i.type, name: i.name, icon: i.icon, x: i.x, y: i.y, isCorrect: i.isCorrect })),
      targetItems: targetItems.map(i => ({ type: i.type, name: i.name, icon: i.icon, x: i.x, y: i.y }))
    });
    await result.save();

    res.status(201).json({ score, total, percentage, passed, validatedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Захищені (адмін) ──────────────────────────────────────────────────────────

router.post('/', auth, async (req, res) => {
  const { templateId } = req.body;
  if (!templateId) {
    return res.status(400).json({ error: 'templateId є обов\'язковим' });
  }
  try {
    const hash = crypto.randomBytes(8).toString('hex');
    const test = new DeskTest({
      templateId,
      hash,
      ownerId: req.user._id
    });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const tests = await DeskTest.find(query).populate('templateId');
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
