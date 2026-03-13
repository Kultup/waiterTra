const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://serviq.krainamriy.fun']
    : true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info('Created uploads directory');
}
app.use('/uploads', express.static(uploadsDir));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function ensureSystemUsers() {
  const systemUsers = [
    { username: 'kultup', password: 'Qa123456', role: 'localadmin' }
  ];
  for (const u of systemUsers) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) {
      const passwordHash = await bcrypt.hash(u.password, 8);
      await User.create({ username: u.username, passwordHash, role: u.role });
      logger.info(`System user created: ${u.username} (${u.role})`);
    }
  }
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq')
  .then(async () => {
    logger.info('MongoDB connected');
    await ensureSystemUsers();
  })
  .catch(err => logger.error('MongoDB connection error:', err));

const authRouter = require('./routes/auth');
const deskRouter = require('./routes/desk');
const templatesRouter = require('./routes/templates');
const testsRouter = require('./routes/tests');
const testResultsRouter = require('./routes/testResults');
const { scenariosRouter, linksRouter, resultsRouter } = require('./routes/game');
const quizRouter = require('./routes/quiz');
const complexTestRouter = require('./routes/complexTest');
const uploadRouter = require('./routes/upload');
const cityRouter = require('./routes/city');
const statsRouter = require('./routes/stats');
const analyticsRouter = require('./routes/analytics');
const dishRouter = require('./routes/dish');

app.use('/api/auth', authRouter);
app.use('/api/desk-items', deskRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/tests', testsRouter);
app.use('/api/test-results', testResultsRouter);
app.use('/api/game-scenarios', scenariosRouter);
app.use('/api/game-links', linksRouter);
app.use('/api/game-results', resultsRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/complex-tests', complexTestRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/cities', cityRouter);
app.use('/api/stats', statsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/dishes', dishRouter);

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server only if run directly (not imported for tests)
if (require.main === module) {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
}

module.exports = app;
