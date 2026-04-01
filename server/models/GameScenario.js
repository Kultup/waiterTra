const mongoose = require('mongoose');

const choiceSchema = new mongoose.Schema({
    choiceId: { type: String, default: '' },
    text: { type: String, required: true },
    nextNodeId: { type: String },
    isWin: { type: Boolean, default: false },
    result: { type: String, default: '' }
});

const characterSchema = new mongoose.Schema({
    charId: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '🧑' },
    color: { type: String, default: '#38bdf8' },
    description: { type: String, default: '' }
});

const nodeSchema = new mongoose.Schema({
    nodeId: { type: String, required: true },
    text: { type: String, required: true },
    speakerId: { type: String, default: null },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    choices: [choiceSchema]
});

const gameScenarioSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    targetCity: { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startNodeId: { type: String, required: true },
    characters: [characterSchema],
    nodes: [nodeSchema],
    createdAt: { type: Date, default: Date.now },
    platform: { type: String, default: '' }
});

gameScenarioSchema.index({ targetCity: 1 });
gameScenarioSchema.index({ ownerId: 1 });

module.exports = mongoose.model('GameScenario', gameScenarioSchema);
