const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const authRouter = require('./routes/auth');
const deskRouter = require('./routes/desk');
const templatesRouter = require('./routes/templates');
const testsRouter = require('./routes/tests');
const testResultsRouter = require('./routes/testResults');
const { scenariosRouter, linksRouter, resultsRouter } = require('./routes/game');
const quizRouter = require('./routes/quiz');
const complexTestRouter = require('./routes/complexTest');

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
