const express = require('express');
const crypto = require('crypto');
const GameScenario = require('../models/GameScenario');
const GameLink = require('../models/GameLink');
const GameResult = require('../models/GameResult');
const requireAuth = require('../middleware/auth');

// ── /api/game-scenarios ───────────────────────────────────────────────────────

const scenariosRouter = express.Router();

scenariosRouter.get('/', requireAuth, async (req, res) => {
  try {
    const scenarios = await GameScenario.find({}, 'title description createdAt');
    res.json(scenarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

scenariosRouter.post('/', requireAuth, async (req, res) => {
  const { title, startNodeId, nodes } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Назва сценарію є обов\'язковою' });
  }
  if (!startNodeId || !String(startNodeId).trim()) {
    return res.status(400).json({ error: 'startNodeId є обов\'язковим' });
  }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: 'Сценарій повинен містити хоча б один вузол' });
  }
  try {
    const scenario = new GameScenario(req.body);
    await scenario.save();
    res.status(201).json(scenario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

scenariosRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const scenario = await GameScenario.findById(req.params.id);
    if (!scenario) return res.status(404).json({ error: 'Сценарій не знайдено' });
    res.json(scenario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

scenariosRouter.put('/:id', requireAuth, async (req, res) => {
  const { title } = req.body;
  if (title !== undefined && (!title || !String(title).trim())) {
    return res.status(400).json({ error: 'Назва сценарію не може бути порожньою' });
  }
  try {
    const scenario = await GameScenario.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!scenario) return res.status(404).json({ error: 'Сценарій не знайдено' });
    res.json(scenario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

scenariosRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    await GameScenario.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
linksRouter.post('/', requireAuth, async (req, res) => {
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
  const { scenarioTitle, playerName, playerLastName, playerPosition, isWin } = req.body;
  if (!scenarioTitle || !String(scenarioTitle).trim()) {
    return res.status(400).json({ error: 'scenarioTitle є обов\'язковим' });
  }
  if (!playerName || !String(playerName).trim()) {
    return res.status(400).json({ error: 'playerName є обов\'язковим' });
  }
  if (!playerLastName || !String(playerLastName).trim()) {
    return res.status(400).json({ error: 'playerLastName є обов\'язковим' });
  }
  if (!playerPosition || !String(playerPosition).trim()) {
    return res.status(400).json({ error: 'playerPosition є обов\'язковим' });
  }
  if (typeof isWin !== 'boolean') {
    return res.status(400).json({ error: 'isWin повинен бути булевим значенням' });
  }
  try {
    const result = new GameResult(req.body);
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Захищений: адмін переглядає результати
resultsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const results = await GameResult.find().sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { scenariosRouter, linksRouter, resultsRouter };
