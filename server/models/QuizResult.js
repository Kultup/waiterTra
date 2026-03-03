const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizTitle: { type: String, required: true },
    hash: { type: String, required: true },
    studentName: { type: String, required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    timeSpent: { type: Number },
    city: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    completedAt: { type: Date, default: Date.now }
});

quizResultSchema.index({ hash: 1 });
quizResultSchema.index({ quizId: 1 });
quizResultSchema.index({ city: 1, completedAt: -1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);
