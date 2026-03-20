const express = require('express');
const router = express.Router();
const City = require('../models/City');
const { auth } = require('../middleware/authMiddleware');
const { platformModelFilter } = require('../utils/platformFilter');

// Public: Get all cities (optionally scoped by platform via query param)
router.get('/', async (req, res) => {
    try {
        // Public route — if platform query param is passed, filter by it
        const filter = req.query.platform ? { platform: req.query.platform } : {};
        const cities = await City.find(filter).sort({ name: 1 });
        res.json(cities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Create city (SuperAdmin only, platform-scoped)
router.post('/', auth, async (req, res) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Назва міста обов\'язкова' });
    }

    try {
        const city = new City({ name: name.trim(), platform: req.user.platform || '' });
        await city.save();
        res.status(201).json(city);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Таке місто вже існує' });
        }
        res.status(400).json({ error: err.message });
    }
});

// Admin: Delete city (SuperAdmin only, platform-scoped)
router.delete('/:id', auth, async (req, res) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied' });
    }

    try {
        const filter = { _id: req.params.id };
        if (req.user.platform) filter.platform = req.user.platform;
        const city = await City.findOneAndDelete(filter);
        if (!city) return res.status(404).json({ error: 'City not found' });
        res.json({ message: 'City deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
