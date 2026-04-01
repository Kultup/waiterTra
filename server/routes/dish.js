const express = require('express');
const router = express.Router();
const Dish = require('../models/Dish');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { platformModelFilter } = require('../utils/platformFilter');
const { DESK_EDITOR_ROLES } = require('../utils/accessPolicy');
const logger = require('../utils/logger');
const deskEditorAuth = [auth, checkRole(DESK_EDITOR_ROLES)];

// GET all dishes (platform-scoped)
router.get('/', deskEditorAuth, async (req, res) => {
    try {
        const filter = platformModelFilter(req.user.platform);
        const dishes = await Dish.find(filter).sort({ createdAt: -1 });
        res.json(dishes);
    } catch (err) {
        logger.error('Error fetching dishes:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new dish (Admin only, platform-scoped)
router.post('/', deskEditorAuth, async (req, res) => {
    try {
        const { name, icon, rotation } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Dish name is required' });
        }
        if (rotation !== undefined && typeof rotation !== 'number') {
            return res.status(400).json({ error: 'Dish rotation must be a number' });
        }

        const newDish = new Dish({
            name,
            icon: icon || '🍽️',
            rotation: rotation ?? 0,
            platform: req.user.platform || ''
        });

        await newDish.save();
        res.status(201).json(newDish);
    } catch (err) {
        logger.error('Error creating dish:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update dish (Admin only, platform-scoped)
router.put('/:id', deskEditorAuth, async (req, res) => {
    try {
        const { name, icon, rotation } = req.body;
        if (rotation !== undefined && typeof rotation !== 'number') {
            return res.status(400).json({ error: 'Dish rotation must be a number' });
        }
        const filter = { _id: req.params.id };
        if (req.user.platform) filter.platform = req.user.platform;

        const updatedDish = await Dish.findOneAndUpdate(
            filter,
            { name, icon, rotation: rotation ?? 0 },
            { new: true, runValidators: true }
        );

        if (!updatedDish) {
            return res.status(404).json({ error: 'Dish not found' });
        }

        res.json(updatedDish);
    } catch (err) {
        logger.error('Error updating dish:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE dish (Admin only, platform-scoped)
router.delete('/:id', deskEditorAuth, async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        if (req.user.platform) filter.platform = req.user.platform;
        const deletedDish = await Dish.findOneAndDelete(filter);

        if (!deletedDish) {
            return res.status(404).json({ error: 'Dish not found' });
        }

        res.json({ message: 'Dish deleted successfully' });
    } catch (err) {
        logger.error('Error deleting dish:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
