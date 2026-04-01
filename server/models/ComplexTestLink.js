const mongoose = require('mongoose');

const complexTestLinkSchema = new mongoose.Schema({
    complexTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplexTest', required: true },
    hash: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    quizAttempts: [{
        stepIndex: { type: Number, required: true },
        answers: [{
            questionIndex: { type: Number, required: true },
            answerIndex: { type: Number, required: true },
            isCorrect: { type: Boolean, required: true },
            answeredAt: { type: Date, default: Date.now }
        }]
    }],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetCity: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ComplexTestLink', complexTestLinkSchema);
