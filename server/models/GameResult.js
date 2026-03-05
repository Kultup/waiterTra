const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
    scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameScenario', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scenarioTitle: { type: String, required: true },
    hash: { type: String },
    studentName: { type: String, required: true },
    studentLastName: { type: String, default: '' },
    city: { type: String, default: '' },
    position: { type: String, default: '' },
    endingTitle: { type: String, default: '' },
    isWin: { type: Boolean },
    choicePath: [{ type: String }],
    // legacy fields kept for backward compatibility
    result: { type: String },
    choicesMade: [{
        nodeId: { type: String },
        choiceText: { type: String }
    }],
    completedAt: { type: Date, default: Date.now }
});

gameResultSchema.index({ hash: 1 });
gameResultSchema.index({ scenarioId: 1 });
gameResultSchema.index({ ownerId: 1, completedAt: -1 });
gameResultSchema.index({ city: 1, completedAt: -1 });

module.exports = mongoose.model('GameResult', gameResultSchema);
