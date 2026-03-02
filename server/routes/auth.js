const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      logger.warn('Login failed:', { username, reason: 'invalid_credentials' });
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    if (user.isBlocked) {
      logger.warn('Login blocked user:', { username });
      return res.status(403).json({ error: 'Ваш акаунт заблоковано. Зверніться до адміністратора.' });
    }

    const token = jwt.sign(
      { _id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info('Login successful:', { username, role: user.role });
    res.json({ token, user: { username: user.username, role: user.role, city: user.city } });
  } catch (err) {
    logger.error('Login error:', { error: err.message, stack: err.stack });
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
    if (existing) {
      logger.warn('Register failed - username exists:', { username });
      return res.status(400).json({ error: 'Логін вже зайнятий' });
    }

    const passwordHash = await bcrypt.hash(password, 8);
    const user = new User({ username, passwordHash, role, city: city || '' });
    await user.save();

    logger.info('User created:', { username, role });
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error('Register error:', { error: err.message, stack: err.stack });
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

// Update user details
router.put('/users/:id', auth, checkRole(['superadmin']), async (req, res) => {
  try {
    const { username, password, role, city } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username) user.username = username;
    if (role) user.role = role;
    if (city !== undefined) user.city = city;
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 8);
    }

    await user.save();
    logger.info('User updated:', { userId: user._id, username: user.username });
    res.json({ success: true });
  } catch (err) {
    logger.error('Update user error:', { error: err.message, stack: err.stack });
    res.status(400).json({ error: err.message });
  }
});

// Toggle block status
router.patch('/users/:id/block', auth, checkRole(['superadmin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'superadmin') return res.status(403).json({ error: 'Cannot block superadmin' });

    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ success: true, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
