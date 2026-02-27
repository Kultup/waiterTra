const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const token = jwt.sign(
      { _id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, user: { username: user.username, role: user.role, city: user.city } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    username: req.user.username,
    role: req.user.role,
    city: req.user.city
  });
});

// Create initial superadmin (or use this for maintenance)
// Note: In production, this should be protected or removed after first use
router.post('/register-root', async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(403).json({ error: 'Forbidden' });

    const { username, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 8);
    const user = new User({ username, passwordHash, role: 'superadmin' });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Management (Superadmin only)

// List all users
router.get('/users', auth, checkRole(['superadmin']), async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register new user
router.post('/register', auth, checkRole(['superadmin']), async (req, res) => {
  try {
    const { username, password, role, city } = req.body;

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Логін вже зайнятий' });

    const passwordHash = await bcrypt.hash(password, 8);
    const user = new User({ username, passwordHash, role, city: city || '' });
    await user.save();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:id', auth, checkRole(['superadmin']), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
