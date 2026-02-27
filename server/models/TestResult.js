const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeskTest', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  templateName: { type: String, required: true },
  studentName: { type: String, required: true },
  studentLastName: { type: String, required: true },
  studentCity: { type: String, required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  userItems: [{ type: String, name: String, icon: String, x: Number, y: Number, isCorrect: Boolean }],
  targetItems: [{ type: String, name: String, icon: String, x: Number, y: Number }],
  completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestResult', testResultSchema);
