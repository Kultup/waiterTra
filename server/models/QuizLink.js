const mongoose = require('mongoose');

const quizLinkSchema = new mongoose.Schema({
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    hash: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    attemptAnswers: [{
        questionIndex: { type: Number, required: true },
        answerIndex: { type: Number, required: true },
        isCorrect: { type: Boolean, required: true },
        answeredAt: { type: Date, default: Date.now }
    }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetCity: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QuizLink', quizLinkSchema);
