const express = require('express');
const crypto = require('crypto');
const DeskTest = require('../models/DeskTest');
const DeskTemplate = require('../models/DeskTemplate');
const MultiDeskTest = require('../models/MultiDeskTest');
const TestResult = require('../models/TestResult');
const PageView = require('../models/PageView');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { validateDeskPlacement } = require('../utils/scoring');
const { buildBaseFilter, buildOwnerQuery } = require('../utils/platformFilter');
const { DESK_EDITOR_ROLES } = require('../utils/accessPolicy');
const { getBindingCity, assertCityBinding } = require('../utils/publicCityBinding');
const { buildPublicDeskTemplate } = require('../utils/publicDeskPayload');
const router = express.Router();
const deskEditorAuth = [auth, checkRole(DESK_EDITOR_ROLES)];

// ── Multi-desk test (адмін створює, студент проходить) ────────────────────────

// Admin: create multi-desk test
router.post('/multi', deskEditorAuth, async (req, res) => {
  const { templateIds } = req.body;
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({ error: 'templateIds повинен бути непорожнім масивом' });
  }
  try {
    const templateQuery = buildBaseFilter(req.user);
    templateQuery._id = { $in: templateIds };
    const templates = await DeskTemplate.find(templateQuery, '_id');
    if (templates.length !== templateIds.length) {
      return res.status(403).json({ error: 'Р§Р°СЃС‚РёРЅР° С€Р°Р±Р»РѕРЅС–РІ РЅРµРґРѕСЃС‚СѓРїРЅР° РґР»СЏ С†СЊРѕРіРѕ РєРѕСЂРёСЃС‚СѓРІР°С‡Р°' });
    }

    const hash = crypto.randomBytes(16).toString('hex');
    const test = new MultiDeskTest({
      templateIds,
      hash,
      ownerId: req.user._id,
      targetCity: req.body.targetCity || ''
    });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: get all multi-desk tests (platform-scoped)
router.get('/multi', deskEditorAuth, async (req, res) => {
  try {
    const query = buildBaseFilter(req.user, 'targetCity');
    const tests = await MultiDeskTest.find(query).populate('templateIds').sort({ createdAt: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: get multi-desk test by hash
router.get('/multi/:hash', async (req, res) => {
  try {
    const test = await MultiDeskTest.findOne({ hash: req.params.hash })
      .populate('templateIds')
      .populate('ownerId', 'city');
    if (!test) return res.status(404).json({ error: 'Тест не знайдено' });
    if (test.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

    const response = test.toObject();
    const bindingCity = getBindingCity(test.targetCity);
    response.city = bindingCity || (test.ownerId ? test.ownerId.city : '');
    response.cityBindingEnabled = Boolean(bindingCity);
    response.cityBindingTarget = bindingCity;

    // Strip scoring coordinates from the public payload, but keep an exact inventory snapshot.
    if (response.templateIds) {
      response.templateIds = response.templateIds.map((template) => buildPublicDeskTemplate(template));
    }

    // Трекінг відвідування
    PageView.create({
      testType: 'multi-desk',
      hash: req.params.hash,
      ownerId: test.ownerId?._id || test.ownerId,
      city: response.city,
      ip: req.ip || req.headers['x-forwarded-for'] || ''
    }).catch(() => { });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check a single multi-desk step — server-side scoring
router.post('/multi/:hash/check-step', async (req, res) => {
  const { stepIndex, items } = req.body;
  if (stepIndex == null || !Array.isArray(items)) {
    return res.status(400).json({ error: 'stepIndex, items required' });
  }
  try {
    const test = await MultiDeskTest.findOne({ hash: req.params.hash }).populate('templateIds');
    if (!test) return res.status(404).json({ error: 'Тест не знайдено' });

    const template = test.templateIds[stepIndex];
    if (!template) return res.status(400).json({ error: 'Invalid stepIndex' });

    const result = validateDeskPlacement(items, template.items);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: submit multi-desk test results
router.post('/multi/:hash/submit', async (req, res) => {
  const { studentName, studentLastName, studentCity, studentPosition, results } = req.body;
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
    if (test.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

    assertCityBinding(getBindingCity(test.targetCity), studentCity, 'посилання');

    const stepResults = [];

    for (let i = 0; i < test.templateIds.length; i++) {
      const template = test.templateIds[i];
      const userItems = results[i]?.items || [];
      const targetItems = template.items;
      const { score, total, percentage, passed, validatedItems, ghostItems } = validateDeskPlacement(userItems, targetItems);

      stepResults.push({ templateName: template.name, score, total, percentage, passed });

      // Also save individual TestResult
      const result = new TestResult({
        testId: test._id, // This is the MultiDeskTest ID
        ownerId: test.ownerId,
        templateName: template.name, // Use template.name for the individual step
        studentName: String(studentName).trim(),
        studentLastName: String(studentLastName).trim(),
        studentCity: String(studentCity).trim(),
        studentPosition: String(studentPosition || '').trim(),
        score, total, percentage, passed
      });
      await result.save();
      
      // Sync student stats and emit real-time event
      await syncStudent(studentName, studentLastName, studentCity, req.app.get('io'), result);
    }

    test.isUsed = true;
    await test.save();

    res.status(201).json({ stepResults });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ── Публічні (студент) ────────────────────────────────────────────────────────

// Студент отримує тест за hash (без авторизації)
router.get('/:hash', async (req, res) => {
  try {
    const test = await DeskTest.findOne({ hash: req.params.hash })
      .populate('templateId')
      .populate('ownerId', 'city');
    if (!test) {
      return res.status(404).json({ error: 'Тест не знайдено' });
    }
    if (test.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

    const response = test.toObject();
    const bindingCity = getBindingCity(test.targetCity, test.city);
    response.city = bindingCity || (test.ownerId ? test.ownerId.city : '');
    response.cityBindingEnabled = Boolean(bindingCity);
    response.cityBindingTarget = bindingCity;

    // Strip template items (correct positions) — scoring is server-side
    if (response.templateId && response.templateId.items) {
      response.templateId = buildPublicDeskTemplate(response.templateId);
    }

    // Трекінг відвідування
    PageView.create({
      testType: 'desk',
      hash: req.params.hash,
      ownerId: test.ownerId?._id || test.ownerId,
      city: response.city,
      ip: req.ip || req.headers['x-forwarded-for'] || ''
    }).catch(() => { });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Студент відправляє відповіді — серверне оцінювання
router.post('/:hash/submit', async (req, res) => {
  const { items, studentName, studentLastName, studentCity, studentPosition } = req.body;

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
    if (test.isUsed) return res.status(410).json({ error: 'Цей тест уже пройдено' });

    assertCityBinding(getBindingCity(test.targetCity, test.city), studentCity, 'посилання');

    const targetItems = test.templateId.items;
    const {
      score,
      total,
      percentage,
      passed,
      validatedItems,
      ghostItems,
      semanticFeedback
    } = validateDeskPlacement(items, targetItems);

    const result = new TestResult({
      testId: test._id,
      ownerId: test.ownerId,
      templateName: test.templateId.templateName || test.templateId.name,
      studentName: String(studentName).trim(),
      studentLastName: String(studentLastName).trim(),
      studentCity: String(studentCity).trim(),
      studentPosition: String(studentPosition || '').trim(),
      score,
      total,
      percentage,
      passed,
      userItems: validatedItems.map(i => ({ type: i.type, name: i.name, icon: i.icon, x: i.x, y: i.y, isCorrect: i.isCorrect })),
      targetItems: targetItems.map(i => ({ type: i.type, name: i.name, icon: i.icon, x: i.x, y: i.y }))
    });
    await result.save();

    // Sync student stats and emit real-time event
    await syncStudent(studentName, studentLastName, studentCity, req.app.get('io'), result);

    test.isUsed = true;
    await test.save();

    res.status(201).json({ score, total, percentage, passed, validatedItems, ghostItems, semanticFeedback });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ── Захищені (адмін) ──────────────────────────────────────────────────────────

router.post('/', deskEditorAuth, async (req, res) => {
  const { templateId, templateName } = req.body;
  if (!templateId) {
    return res.status(400).json({ error: 'templateId є обов\'язковим' });
  }
  try {
    const hash = crypto.randomBytes(16).toString('hex');
    const template = await DeskTemplate.findOne(buildOwnerQuery(req.user, templateId));
    if (!template) {
      return res.status(403).json({ error: 'РЁР°Р±Р»РѕРЅ РЅРµ Р·РЅР°Р№РґРµРЅРѕ Р°Р±Рѕ РЅРµРјР°С” РґРѕСЃС‚СѓРїСѓ' });
    }
    const test = new DeskTest({
      templateId,
      templateName: templateName || 'Шаблон',
      description: template?.description || '',
      hash,
      ownerId: req.user._id,
      targetCity: req.body.targetCity || ''
    });
    await test.save();
    res.status(201).json(test);
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/', deskEditorAuth, async (req, res) => {
  try {
    const query = buildBaseFilter(req.user, 'targetCity');
    const tests = await DeskTest.find(query).populate('templateId').sort({ createdAt: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
