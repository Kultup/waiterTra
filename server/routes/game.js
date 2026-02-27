const express = require('express');
const crypto = require('crypto');
const GameScenario = require('../models/GameScenario');
const GameLink = require('../models/GameLink');
const GameResult = require('../models/GameResult');
const { auth } = require('../middleware/authMiddleware'); // Changed import

// ── /api/game-scenarios ───────────────────────────────────────────────────────

const scenariosRouter = express.Router();

// Admin: Get all scenarios
scenariosRouter.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const scenarios = await GameScenario.find(query, 'title description createdAt').sort({ createdAt: -1 }); // Added query and sort
    res.json(scenarios);
  } catch (err) { // Changed error variable name
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create scenario
scenariosRouter.post('/', auth, async (req, res) => {
  // Removed client-side validation for title, startNodeId, nodes as it's handled by Mongoose schema or implied to be handled elsewhere
  try {
    const scenario = new GameScenario({
      ...req.body,
      ownerId: req.user._id // Set ownerId from authenticated user
    });
    await scenario.save();
    res.status(201).json(scenario);
  } catch (err) { // Changed error variable name
    res.status(400).json({ error: err.message });
  }
});

scenariosRouter.get('/:id', auth, async (req, res) => { // Changed middleware
  try {
    const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
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
    const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
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
    const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
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
    const link = await GameLink.findOne({ hash: req.params.hash }).populate('scenarioId');
    if (!link) return res.status(404).json({ error: 'Посилання не знайдено' });
    res.json(link);
  } catch (error) {
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
    const hash = crypto.randomBytes(8).toString('hex');
    const link = new GameLink({ scenarioId, hash });
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
  const { scenarioTitle, playerName, playerLastName, playerCity, isWin } = req.body;

  if (!scenarioTitle || !String(scenarioTitle).trim()) {
    return res.status(400).json({ error: 'scenarioTitle є обов\'язковим' });
  }
  if (!playerName || !String(playerName).trim()) {
    return res.status(400).json({ error: 'playerName є обов\'язковим' });
  }
  if (!playerLastName || !String(playerLastName).trim()) {
    return res.status(400).json({ error: 'playerLastName є обов\'язковим' });
  }
  if (!playerCity || !String(playerCity).trim()) {
    return res.status(400).json({ error: 'playerCity є обов\'язковим' });
  }
  if (typeof isWin !== 'boolean') {
    return res.status(400).json({ error: 'isWin повинен бути булевим значенням' });
  }

  try {
    const scenario = await GameScenario.findOne({ title: scenarioTitle });
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

    const result = new GameResult({
      ...req.body,
      scenarioId: scenario._id,
      ownerId: scenario.ownerId
    });
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Захищений: адмін переглядає результати
resultsRouter.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const results = await GameResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { scenariosRouter, linksRouter, resultsRouter };
