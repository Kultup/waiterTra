const express = require('express');
const DeskTemplate = require('../models/DeskTemplate');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

// Get all templates
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const templates = await DeskTemplate.find(query).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', auth, async (req, res) => {
  const { name, items } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Назва шаблону є обов\'язковою' });
  }
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items повинен бути масивом' });
  }
  try {
    const template = new DeskTemplate({
      ...req.body,
      ownerId: req.user._id
    });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { name } = req.body;
  if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Назва шаблону не може бути порожньою' });
  }
  try {
    const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
    const template = await DeskTemplate.findOneAndUpdate(
      query,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) {
      return res.status(404).json({ error: 'Шаблон не знайдено або немає доступу' });
    }
    res.json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? { _id: req.params.id } : { _id: req.params.id, ownerId: req.user._id };
    const template = await DeskTemplate.findOneAndDelete(query);
    if (!template) return res.status(404).json({ error: 'Template not found or unauthorized' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
