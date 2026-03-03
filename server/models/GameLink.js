const mongoose = require('mongoose');

const gameLinkSchema = new mongoose.Schema({
    scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameScenario', required: true },
    hash: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
});

gameLinkSchema.index({ hash: 1 });

module.exports = mongoose.model('GameLink', gameLinkSchema);
