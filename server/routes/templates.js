const express = require('express');
const DeskTemplate = require('../models/DeskTemplate');
const requireAuth = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const templates = await DeskTemplate.find();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, items } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Назва шаблону є обов\'язковою' });
  }
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items повинен бути масивом' });
  }
  try {
    const template = new DeskTemplate(req.body);
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Назва шаблону не може бути порожньою' });
  }
  try {
    const template = await DeskTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) {
      return res.status(404).json({ error: 'Шаблон не знайдено' });
    }
    res.json(template);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await DeskTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
