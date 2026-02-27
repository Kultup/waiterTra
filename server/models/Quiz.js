const mongoose = require('mongoose');
const crypto = require('crypto');

const QuizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    timeLimit: { type: Number, default: 0 }, // in minutes, 0 = no limit
    passingScore: { type: Number, default: 80 }, // percentage
    questions: [{
        text: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctIndex: { type: Number, required: true },
        image: String
    }],
    hash: { type: String, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

QuizSchema.pre('save', function (next) {
    if (!this.hash) {
        this.hash = crypto.randomBytes(8).toString('hex');
    }
    next();
});

module.exports = mongoose.model('Quiz', QuizSchema);
