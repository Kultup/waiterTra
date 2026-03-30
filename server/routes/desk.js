const express = require('express');
const DeskItem = require('../models/DeskItem');
const Dish = require('../models/Dish');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const query = { ownerId: req.user._id };
    const items = await DeskItem.find(query);
    
    // Server-side filtering: only return items whose 'type' exists in the Dish collection
    const dishes = await Dish.find({}, '_id');
    const dishIds = dishes.map(d => String(d._id));
    
    const validItems = items.filter(item => dishIds.includes(String(item.type)));
    res.json(validItems);
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

router.patch('/:id', auth, async (req, res) => {
  const allowedFields = ['x', 'y', 'width', 'height', 'rotation', 'zIndex'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== 'number') {
        return res.status(400).json({ error: `${field} must be a number` });
      }
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const item = await DeskItem.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const query = { _id: req.params.id, ownerId: req.user._id };
    const item = await DeskItem.findOneAndDelete(query);
    if (!item) return res.status(404).json({ error: 'Item not found or unauthorized' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk DELETE all items for the current user
router.delete('/', auth, async (req, res) => {
  try {
    await DeskItem.deleteMany({ ownerId: req.user._id });
    res.json({ message: 'All items deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
