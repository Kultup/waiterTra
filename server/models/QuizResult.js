const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentName: { type: String, required: true },
    studentLastName: { type: String, default: '' },
    studentCity: { type: String, default: '' },
    studentPosition: { type: String, default: '' },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    answers: [{ type: mongoose.Schema.Types.Mixed }],
    // legacy fields kept for backward compatibility
    quizTitle: { type: String },
    hash: { type: String },
    totalQuestions: { type: Number },
    correctAnswers: { type: Number },
    timeSpent: { type: Number },
    city: { type: String, default: '' },
    completedAt: { type: Date, default: Date.now }
});

quizResultSchema.index({ ownerId: 1, completedAt: -1 });
quizResultSchema.index({ quizId: 1 });
quizResultSchema.index({ studentCity: 1, completedAt: -1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);
