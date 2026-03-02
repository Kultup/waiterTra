const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => logger.info('MongoDB connected'))
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
