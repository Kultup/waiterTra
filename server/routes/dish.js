const express = require('express');
const router = express.Router();
const Dish = require('../models/Dish');
const { auth } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Only allow admin and superadmin to view and modify dishes for configuration
const adminAuth = (req, res, next) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// GET all dishes (public/any logged in user needs this to play)
router.get('/', auth, async (req, res) => {
    try {
        const dishes = await Dish.find().sort({ createdAt: -1 });
        res.json(dishes);
    } catch (err) {
        logger.error('Error fetching dishes:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST new dish (Admin only)
router.post('/', [auth, adminAuth], async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Dish name is required' });
        }
        
        const newDish = new Dish({
            name,
            icon: icon || '🍽️'
        });

        await newDish.save();
        res.status(201).json(newDish);
    } catch (err) {
        logger.error('Error creating dish:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT update dish (Admin only)
router.put('/:id', [auth, adminAuth], async (req, res) => {
    try {
        const { name, icon } = req.body;
        
        const updatedDish = await Dish.findByIdAndUpdate(
            req.params.id,
            { name, icon },
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

// DELETE dish (Admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
    try {
        const deletedDish = await Dish.findByIdAndDelete(req.params.id);
        
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
