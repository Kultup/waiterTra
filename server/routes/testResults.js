const express = require('express');
const TestResult = require('../models/TestResult');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'superadmin') {
      query = {};
    } else if (req.user.role === 'viewer') {
      // viewer бачить результати свого міста
      query = req.user.city ? { studentCity: req.user.city } : { _id: null };
    } else {
      // admin/trainer — тільки свої тести
      query = { ownerId: req.user._id };
    }
    const results = await TestResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
