const express = require('express');
const crypto = require('crypto');
const GameScenario = require('../models/GameScenario');
const GameLink = require('../models/GameLink');
const GameResult = require('../models/GameResult');
const PageView = require('../models/PageView');
const { auth } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { buildBaseFilter, buildOwnerQuery, buildResultFilter } = require('../utils/platformFilter');

// ── /api/game-scenarios ───────────────────────────────────────────────────────

const scenariosRouter = express.Router();

// Admin: Get all scenarios (platform-scoped)
scenariosRouter.get('/', auth, async (req, res) => {
  try {
    const query = buildBaseFilter(req.user, 'targetCity');
    const scenarios = await GameScenario.find(query, 'title description targetCity createdAt').sort({ createdAt: -1 });
    res.json(scenarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create scenario
scenariosRouter.post('/', auth, async (req, res) => {
  // Removed client-side validation for title, startNodeId, nodes as it's handled by Mongoose schema or implied to be handled elsewhere
  try {
    const scenario = new GameScenario({
      ...req.body,
      ownerId: req.user._id,
      platform: req.user.platform || ''
    });
    await scenario.save();
    res.status(201).json(scenario);
  } catch (err) { // Changed error variable name
    res.status(400).json({ error: err.message });
  }
});

scenariosRouter.get('/:id', auth, async (req, res) => { // Changed middleware
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const scenario = await GameScenario.findOne(query); // Used findOne with query
    if (!scenario) return res.status(404).json({ error: 'Сценарій не знайдено або немає доступу' }); // Updated message
    res.json(scenario);
  } catch (err) { // Changed error variable name
    res.status(500).json({ error: err.message });
  }
});

scenariosRouter.put('/:id', auth, async (req, res) => { // Changed middleware
  const { title } = req.body;
  if (title !== undefined && (!title || !String(title).trim())) {
    return res.status(400).json({ error: 'Назва сценарію не може бути порожньою' });
  }
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const scenario = await GameScenario.findOneAndUpdate( // Used findOneAndUpdate
      query, req.body, { new: true, runValidators: true }
    );
    if (!scenario) return res.status(404).json({ error: 'Сценарій не знайдено або немає доступу' }); // Updated message
    res.json(scenario);
  } catch (err) { // Changed error variable name
    res.status(400).json({ error: err.message });
  }
});

// Admin: Delete scenario
scenariosRouter.delete('/:id', auth, async (req, res) => { // Changed middleware
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const scenario = await GameScenario.findOneAndDelete(query); // Used findOneAndDelete
    if (!scenario) return res.status(404).json({ error: 'Scenario not found or unauthorized' }); // Updated message
    res.json({ success: true }); // Updated success message
  } catch (err) { // Changed error variable name
    res.status(500).json({ error: err.message });
  }
});

// ── /api/game-links ───────────────────────────────────────────────────────────

const linksRouter = express.Router();

// Публічний: студент отримує гру за hash (без авторизації)
linksRouter.get('/:hash', async (req, res) => {
  try {
    const link = await GameLink.findOne({ hash: req.params.hash })
      .populate('scenarioId');

    console.log('Game link lookup:', {
      hash: req.params.hash,
      found: !!link,
      scenarioId: link?.scenarioId?._id,
      isUsed: link?.isUsed,
      isActive: link?.isActive
    });

    if (!link) {
      console.error('Link not found for hash:', req.params.hash);
      return res.status(404).json({ error: 'Посилання не знайдено' });
    }

    if (link.isUsed || !link.isActive) {
      console.error('Link is used/inactive for hash:', req.params.hash);
      return res.status(410).json({
        error: 'Це посилання вже використано',
        isUsed: true
      });
    }

    if (!link.scenarioId) {
      console.error('Scenario not found for link hash:', req.params.hash);
      return res.status(404).json({ error: 'Сценарій не знайдено' });
    }

    const response = {
      scenarioId: link.scenarioId,
      city: link.scenarioId.targetCity || ''
    };

    // Трекінг відвідування
    PageView.create({
      testType: 'game',
      hash: req.params.hash,
      ownerId: link.ownerId,
      city: response.city,
      ip: req.ip || req.headers['x-forwarded-for'] || ''
    }).catch(() => { });

    console.log('Returning game data:', {
      scenarioTitle: link.scenarioId.title,
      hasStartNode: !!link.scenarioId.startNodeId,
      city: response.city
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching game link:', error);
    res.status(500).json({ error: error.message });
  }
});

// Захищений: адмін створює посилання
linksRouter.post('/', auth, async (req, res) => {
  const { scenarioId } = req.body;
  if (!scenarioId) {
    return res.status(400).json({ error: 'scenarioId є обов\'язковим' });
  }
  try {
    // Перевіряємо що сценарій належить цьому користувачу або він superadmin
    const ownerQuery = buildOwnerQuery(req.user, scenarioId);
    const scenario = await GameScenario.findOne(ownerQuery);
    if (!scenario) return res.status(403).json({ error: 'Сценарій не знайдено або немає доступу' });

    const hash = crypto.randomBytes(16).toString('hex');
    const link = new GameLink({ scenarioId, hash, ownerId: req.user._id });
    await link.save();
    res.status(201).json(link);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── /api/game-results ─────────────────────────────────────────────────────────

const resultsRouter = express.Router();

// Публічний: студент відправляє результат (без авторизації)
resultsRouter.post('/', async (req, res) => {
  console.log('=== GAME RESULTS ENDPOINT CALLED ===');
  const { scenarioTitle, playerName, playerLastName, playerCity, playerPosition, isWin, hash } = req.body;

  console.log('Received game result:', {
    scenarioTitle,
    playerName,
    playerLastName,
    playerCity,
    playerPosition,
    isWin,
    hash,
    hasHash: !!hash
  });

  if (!scenarioTitle || !String(scenarioTitle).trim()) {
    console.error('Validation failed: scenarioTitle missing');
    return res.status(400).json({ error: 'scenarioTitle є обов\'язковим' });
  }
  if (!playerName || !String(playerName).trim()) {
    console.error('Validation failed: playerName missing');
    return res.status(400).json({ error: 'playerName є обов\'язковим' });
  }
  if (!playerLastName || !String(playerLastName).trim()) {
    console.error('Validation failed: playerLastName missing');
    return res.status(400).json({ error: 'playerLastName є обов\'язковим' });
  }
  // playerCity is now optional
  if (typeof isWin !== 'boolean') {
    console.error('Validation failed: isWin not boolean', { isWin });
    return res.status(400).json({ error: 'isWin повинен бути булевим значенням' });
  }

  try {
    const scenario = await GameScenario.findOne({ title: scenarioTitle });
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

    const endingTitle = req.body.endingTitle || '';

    const result = new GameResult({
      scenarioId: scenario._id,
      ownerId: scenario.ownerId,
      scenarioTitle: scenario.title,
      studentName: playerName || '',
      studentLastName: playerLastName || '',
      city: playerCity || '',
      position: playerPosition || '',
      endingTitle,
      isWin,
      hash,
      choicePath: req.body.choicePath || []
    });
    await result.save();

    // Sync student stats and emit real-time event
    await syncStudent(result.studentName, result.studentLastName, result.city, req.app.get('io'), result);

    console.log('Result saved successfully, hash:', hash);

    // Mark link as used if hash provided
    if (hash) {
      console.log('Attempting to mark link as used...');
      const updateResult = await GameLink.findOneAndUpdate({ hash }, { isUsed: true });
      console.log('Link marked as used:', !!updateResult);

      // Verify the update
      const verifyLink = await GameLink.findOne({ hash });
      console.log('Verified link isUsed:', verifyLink?.isUsed);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error saving game result:', error);
    res.status(400).json({ error: error.message });
  }
});

// Захищений: адмін переглядає результати (platform-scoped)
resultsRouter.get('/', auth, async (req, res) => {
  try {
    const query = await buildResultFilter(req.user, 'city');
    const results = await GameResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH city
resultsRouter.patch('/:id/city', auth, async (req, res) => {
  try {
    if (!['superadmin', 'admin', 'trainer'].includes(req.user.role))
      return res.status(403).json({ error: 'Немає доступу' });
    const { city } = req.body;
    if (!city || !city.trim()) return res.status(400).json({ error: 'Місто обов\'язкове' });
    const result = await GameResult.findByIdAndUpdate(
      req.params.id,
      { city: city.trim() },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Результат не знайдено' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { scenariosRouter, linksRouter, resultsRouter };
