const express = require('express');
const crypto = require('crypto');
const GameScenario = require('../models/GameScenario');
const GameLink = require('../models/GameLink');
const GameResult = require('../models/GameResult');
const PageView = require('../models/PageView');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { syncStudent } = require('../utils/studentSync');
const { buildBaseFilter, buildOwnerQuery, buildResultFilter } = require('../utils/platformFilter');
const { SCENARIO_EDITOR_ROLES, RESULT_VIEW_ROLES, RESULT_EDIT_ROLES } = require('../utils/accessPolicy');
const { getBindingCity, assertCityBinding } = require('../utils/publicCityBinding');

const createValidationError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeChoicePath = (choicePath) => {
  if (!Array.isArray(choicePath)) {
    return [];
  }

  return choicePath.map((entry) => {
    if (typeof entry === 'string') {
      return { nodeText: '', choiceText: entry.trim() };
    }

    return {
      nodeText: String(entry?.nodeText || '').trim(),
      choiceText: String(entry?.choiceText || '').trim()
    };
  });
};

const normalizeScenarioPayload = (payload = {}) => {
  const title = String(payload.title || '').trim();
  if (!title) {
    throw createValidationError('Назва сценарію не може бути порожньою');
  }

  const description = String(payload.description || '').trim();
  const targetCity = String(payload.targetCity || '').trim();

  const characters = Array.isArray(payload.characters)
    ? payload.characters.map((character, index) => {
      const charId = String(character?.charId || '').trim();
      const name = String(character?.name || '').trim();

      if (!charId) {
        throw createValidationError(`Персонаж #${index + 1} має містити charId`);
      }
      if (!name) {
        throw createValidationError(`Персонаж #${index + 1} має містити ім'я`);
      }

      return {
        charId,
        name,
        avatar: String(character?.avatar || '🧑').trim() || '🧑',
        color: String(character?.color || '#38bdf8').trim() || '#38bdf8',
        description: String(character?.description || '').trim()
      };
    })
    : [];

  const characterIds = new Set(characters.map((character) => character.charId));
  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];

  if (rawNodes.length === 0) {
    throw createValidationError('Сценарій повинен містити хоча б один вузол');
  }

  const seenNodeIds = new Set();
  const normalizedNodes = rawNodes.map((node, nodeIndex) => {
    const nodeId = String(node?.nodeId || '').trim();
    const text = String(node?.text || '').trim();

    if (!nodeId) {
      throw createValidationError(`Вузол #${nodeIndex + 1} має містити nodeId`);
    }
    if (!text) {
      throw createValidationError(`Вузол #${nodeIndex + 1} має містити текст сцени`);
    }
    if (seenNodeIds.has(nodeId)) {
      throw createValidationError(`nodeId "${nodeId}" використовується більше одного разу`);
    }
    seenNodeIds.add(nodeId);

    const speakerId = node?.speakerId ? String(node.speakerId).trim() : null;
    if (speakerId && !characterIds.has(speakerId)) {
      throw createValidationError(`Вузол "${nodeId}" посилається на неіснуючого персонажа`);
    }

    const x = Number(node?.x);
    const y = Number(node?.y);

    const choices = Array.isArray(node?.choices)
      ? node.choices.map((choice, choiceIndex) => {
        const choiceText = String(choice?.text || '').trim();
        if (!choiceText) {
          throw createValidationError(`Вузол "${nodeId}" має вибір #${choiceIndex + 1} без тексту`);
        }

        return {
          choiceId: String(choice?.choiceId || '').trim(),
          text: choiceText,
          nextNodeId: choice?.nextNodeId ? String(choice.nextNodeId).trim() : null,
          isWin: Boolean(choice?.isWin),
          result: String(choice?.result || '').trim()
        };
      })
      : [];

    return {
      nodeId,
      text,
      speakerId,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      choices
    };
  });

  const nodeIds = new Set(normalizedNodes.map((node) => node.nodeId));
  const startNodeId = String(payload.startNodeId || '').trim();
  if (!startNodeId || !nodeIds.has(startNodeId)) {
    throw createValidationError('Стартовий вузол має існувати серед вузлів сценарію');
  }

  normalizedNodes.forEach((node) => {
    node.choices.forEach((choice) => {
      if (choice.nextNodeId && !nodeIds.has(choice.nextNodeId)) {
        throw createValidationError(`Вузол "${node.nodeId}" посилається на неіснуючий nextNodeId`);
      }
    });
  });

  return {
    title,
    description,
    targetCity,
    startNodeId,
    characters,
    nodes: normalizedNodes
  };
};

const getPlayableScenario = (scenarioDoc) => {
  const scenario = scenarioDoc?.toObject ? scenarioDoc.toObject() : scenarioDoc;
  const nodes = Array.isArray(scenario?.nodes) ? scenario.nodes : [];
  const hasValidStartNode = nodes.some((node) => node.nodeId === scenario?.startNodeId);

  return {
    ...scenario,
    startNodeId: hasValidStartNode ? scenario.startNodeId : (nodes[0]?.nodeId || null)
  };
};

const resolveScenarioForResult = async ({ hash, scenarioId, scenarioTitle }) => {
  if (hash) {
    const link = await GameLink.findOne({ hash }).populate('scenarioId');
    if (!link) {
      throw createValidationError('Посилання не знайдено', 404);
    }
    if (link.isUsed || !link.isActive) {
      throw createValidationError('Це посилання вже використано', 410);
    }
    if (!link.scenarioId) {
      throw createValidationError('Сценарій не знайдено', 404);
    }

    return { scenario: link.scenarioId, link };
  }

  if (scenarioId) {
    const scenario = await GameScenario.findById(scenarioId);
    if (!scenario) {
      throw createValidationError('Сценарій не знайдено', 404);
    }

    return { scenario, link: null };
  }

  if (scenarioTitle) {
    const scenario = await GameScenario.findOne({ title: String(scenarioTitle).trim() });
    if (!scenario) {
      throw createValidationError('Сценарій не знайдено', 404);
    }

    return { scenario, link: null };
  }

  throw createValidationError('hash або scenarioId є обов\'язковими');
};

const scenariosRouter = express.Router();
const scenarioEditorAuth = [auth, checkRole(SCENARIO_EDITOR_ROLES)];

scenariosRouter.get('/', scenarioEditorAuth, async (req, res) => {
  try {
    const query = buildBaseFilter(req.user, 'targetCity');
    const scenarios = await GameScenario.find(query, 'title description targetCity createdAt').sort({ createdAt: -1 });
    res.json(scenarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

scenariosRouter.post('/', scenarioEditorAuth, async (req, res) => {
  try {
    const normalizedPayload = normalizeScenarioPayload(req.body);
    const scenario = new GameScenario({
      ...normalizedPayload,
      ownerId: req.user._id,
      platform: req.user.platform || ''
    });
    await scenario.save();
    res.status(201).json(scenario);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

scenariosRouter.get('/:id', scenarioEditorAuth, async (req, res) => {
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const scenario = await GameScenario.findOne(query);
    if (!scenario) {
      return res.status(404).json({ error: 'Сценарій не знайдено або немає доступу' });
    }

    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

scenariosRouter.put('/:id', scenarioEditorAuth, async (req, res) => {
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const normalizedPayload = normalizeScenarioPayload(req.body);
    const scenario = await GameScenario.findOneAndUpdate(
      query,
      normalizedPayload,
      { new: true, runValidators: true }
    );
    if (!scenario) {
      return res.status(404).json({ error: 'Сценарій не знайдено або немає доступу' });
    }

    res.json(scenario);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

scenariosRouter.delete('/:id', scenarioEditorAuth, async (req, res) => {
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const scenario = await GameScenario.findOneAndDelete(query);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found or unauthorized' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const linksRouter = express.Router();

linksRouter.get('/:hash', async (req, res) => {
  try {
    const link = await GameLink.findOne({ hash: req.params.hash }).populate('scenarioId');

    if (!link) {
      return res.status(404).json({ error: 'Посилання не знайдено' });
    }
    if (link.isUsed || !link.isActive) {
      return res.status(410).json({
        error: 'Це посилання вже використано',
        isUsed: true
      });
    }
    if (!link.scenarioId) {
      return res.status(404).json({ error: 'Сценарій не знайдено' });
    }

    const playableScenario = getPlayableScenario(link.scenarioId);
    if (!Array.isArray(playableScenario.nodes) || playableScenario.nodes.length === 0 || !playableScenario.startNodeId) {
      return res.status(409).json({ error: 'Сценарій пошкоджено або він не містить стартового вузла' });
    }

    const bindingCity = getBindingCity(link.targetCity, playableScenario.targetCity);
    const response = {
      scenarioId: playableScenario,
      city: bindingCity || '',
      cityBindingEnabled: Boolean(bindingCity),
      cityBindingTarget: bindingCity
    };

    PageView.create({
      testType: 'game',
      hash: req.params.hash,
      ownerId: link.ownerId,
      city: response.city,
      ip: req.ip || req.headers['x-forwarded-for'] || ''
    }).catch(() => { });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

linksRouter.post('/', scenarioEditorAuth, async (req, res) => {
  const { scenarioId } = req.body;
  if (!scenarioId) {
    return res.status(400).json({ error: 'scenarioId є обов\'язковим' });
  }

  try {
    const ownerQuery = buildOwnerQuery(req.user, scenarioId);
    const scenario = await GameScenario.findOne(ownerQuery);
    if (!scenario) {
      return res.status(403).json({ error: 'Сценарій не знайдено або немає доступу' });
    }

    const hash = crypto.randomBytes(16).toString('hex');
    const link = new GameLink({
      scenarioId,
      hash,
      ownerId: req.user._id,
      targetCity: getBindingCity(scenario.targetCity)
    });
    await link.save();
    res.status(201).json(link);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const resultsRouter = express.Router();

resultsRouter.post('/', async (req, res) => {
  const {
    scenarioId,
    scenarioTitle,
    playerName,
    playerLastName,
    playerCity,
    playerPosition,
    isWin,
    hash,
    endingTitle
  } = req.body;

  if (!playerName || !String(playerName).trim()) {
    return res.status(400).json({ error: 'playerName є обов\'язковим' });
  }
  if (!playerLastName || !String(playerLastName).trim()) {
    return res.status(400).json({ error: 'playerLastName є обов\'язковим' });
  }
  if (typeof isWin !== 'boolean') {
    return res.status(400).json({ error: 'isWin повинен бути булевим значенням' });
  }

  try {
    const { scenario, link } = await resolveScenarioForResult({ hash, scenarioId, scenarioTitle });
    assertCityBinding(getBindingCity(link?.targetCity, scenario.targetCity), playerCity, 'посилання');

    const result = new GameResult({
      scenarioId: scenario._id,
      ownerId: scenario.ownerId,
      scenarioTitle: scenario.title,
      studentName: String(playerName || '').trim(),
      studentLastName: String(playerLastName || '').trim(),
      city: String(playerCity || '').trim(),
      position: String(playerPosition || '').trim(),
      endingTitle: String(endingTitle || '').trim(),
      isWin,
      hash: hash || '',
      choicePath: normalizeChoicePath(req.body.choicePath)
    });
    await result.save();

    await syncStudent(result.studentName, result.studentLastName, result.city, req.app.get('io'), result);

    if (link) {
      link.isUsed = true;
      await link.save();
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

resultsRouter.get('/', auth, checkRole(RESULT_VIEW_ROLES), async (req, res) => {
  try {
    const query = await buildResultFilter(req.user, 'city');
    const results = await GameResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

resultsRouter.patch('/:id/city', auth, checkRole(RESULT_EDIT_ROLES), async (req, res) => {
  try {
    if (!['superadmin', 'admin', 'trainer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Немає доступу' });
    }

    const { city } = req.body;
    if (!city || !city.trim()) {
      return res.status(400).json({ error: 'Місто обов\'язкове' });
    }

    const query = await buildResultFilter(req.user, 'city');
    query._id = req.params.id;
    const result = await GameResult.findOneAndUpdate(
      query,
      { city: city.trim() },
      { new: true }
    );
    if (!result) {
      return res.status(404).json({ error: 'Результат не знайдено' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { scenariosRouter, linksRouter, resultsRouter };
