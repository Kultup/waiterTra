const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
  hash: { type: String, default: '' },
  scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameScenario' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scenarioTitle: { type: String, required: true },
  playerName: { type: String, required: true },
  playerLastName: { type: String, required: true },
  playerCity: { type: String, required: true },
  endingTitle: { type: String, default: '' },
  isWin: { type: Boolean, required: true },
  choicePath: [{ nodeText: String, choiceText: String }],
  completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameResult', gameResultSchema);
