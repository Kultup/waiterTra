const mongoose = require('mongoose');
const crypto = require('crypto');

const complexStepSchema = new mongoose.Schema({
    type: { type: String, enum: ['desk', 'game', 'quiz'], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, default: '' },
    timeLimit: { type: Number, default: 0 }
}, { _id: false });

const complexTestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    steps: [complexStepSchema],
    isUsed: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetCity: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ComplexTest', complexTestSchema);
