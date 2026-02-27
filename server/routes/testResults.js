const express = require('express');
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'superadmin' ? {} : { ownerId: req.user._id };
    const results = await TestResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
