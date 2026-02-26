const express = require('express');
const crypto = require('crypto');
const DeskTest = require('../models/DeskTest');
const TestResult = require('../models/TestResult');
const requireAuth = require('../middleware/auth');
const router = express.Router();

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
  const { items, studentName, studentLastName, studentPosition } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items повинен бути масивом' });
  }
  if (!studentName || !String(studentName).trim()) {
    return res.status(400).json({ error: 'Ім\'я студента є обов\'язковим' });
  }
  if (!studentLastName || !String(studentLastName).trim()) {
    return res.status(400).json({ error: 'Прізвище студента є обов\'язковим' });
  }
  if (!studentPosition || !String(studentPosition).trim()) {
    return res.status(400).json({ error: 'Посада студента є обов\'язковою' });
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
      templateName: test.templateId.name,
      studentName: String(studentName).trim(),
      studentLastName: String(studentLastName).trim(),
      studentPosition: String(studentPosition).trim(),
      score,
      total,
      percentage,
      passed
    });
    await result.save();

    res.status(201).json({ score, total, percentage, passed, validatedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Захищені (адмін) ──────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  const { templateId } = req.body;
  if (!templateId) {
    return res.status(400).json({ error: 'templateId є обов\'язковим' });
  }
  try {
    const hash = crypto.randomBytes(8).toString('hex');
    const test = new DeskTest({ templateId, hash });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const tests = await DeskTest.find();
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
