const express = require('express');
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/authMiddleware');
const { buildResultFilter } = require('../utils/platformFilter');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const query = await buildResultFilter(req.user, 'studentCity');
    const results = await TestResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH city
router.patch('/:id/city', auth, async (req, res) => {
  try {
    if (!['superadmin', 'admin', 'trainer'].includes(req.user.role))
      return res.status(403).json({ error: 'Немає доступу' });
    const { city } = req.body;
    if (!city || !city.trim()) return res.status(400).json({ error: 'Місто обов\'язкове' });
    const result = await TestResult.findByIdAndUpdate(
      req.params.id,
      { studentCity: city.trim(), city: city.trim() },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: 'Результат не знайдено' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
