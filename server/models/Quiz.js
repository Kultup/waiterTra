const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    city: { type: String, default: '' },
    questions: [{
        text: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctIndex: { type: Number, required: true },
        image: { type: String },
        explanation: { type: String }
    }],
    timeLimit: { type: Number, default: 300 },
    passingScore: { type: Number, default: 70 },
    hash: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

quizSchema.index({ hash: 1 });
quizSchema.index({ city: 1, isActive: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
