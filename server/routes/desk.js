const express = require('express');
const DeskItem = require('../models/DeskItem');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const items = await DeskItem.find(query);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, x, y } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Поле name є обов\'язковим' });
  }
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'Поля x та y повинні бути числами' });
  }
  try {
    const item = new DeskItem({ ...req.body, ownerId: req.user._id });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await DeskItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
