const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
    scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameScenario', required: true },
    scenarioTitle: { type: String, required: true },
    hash: { type: String, required: true },
    studentName: { type: String, required: true },
    result: { type: String },
    isWin: { type: Boolean },
    choicesMade: [{
        nodeId: { type: String },
        choiceText: { type: String }
    }],
    city: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    completedAt: { type: Date, default: Date.now }
});

gameResultSchema.index({ hash: 1 });
gameResultSchema.index({ scenarioId: 1 });
gameResultSchema.index({ city: 1, completedAt: -1 });

module.exports = mongoose.model('GameResult', gameResultSchema);
