const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeskTest', required: true },
  templateName: { type: String, required: true },
  studentName: { type: String, required: true },
  studentLastName: { type: String, required: true },
  studentPosition: { type: String, required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestResult', testResultSchema);
