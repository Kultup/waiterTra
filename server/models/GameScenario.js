const mongoose = require('mongoose');

const choiceSchema = new mongoose.Schema({
    text: { type: String, required: true },
    nextNodeId: { type: String },
    isWin: { type: Boolean },
    result: { type: String }
});

const nodeSchema = new mongoose.Schema({
    nodeId: { type: String, required: true },
    text: { type: String, required: true },
    choices: [choiceSchema]
});

const gameScenarioSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    targetCity: { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startNodeId: { type: String, required: true },
    nodes: [nodeSchema],
    createdAt: { type: Date, default: Date.now }
});

gameScenarioSchema.index({ targetCity: 1 });
gameScenarioSchema.index({ ownerId: 1 });

module.exports = mongoose.model('GameScenario', gameScenarioSchema);
