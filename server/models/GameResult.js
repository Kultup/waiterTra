const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
  hash:           { type: String, default: '' },
  scenarioTitle:  { type: String, required: true },
  playerName:     { type: String, required: true },
  playerLastName: { type: String, required: true },
  playerPosition: { type: String, required: true },
  endingTitle:    { type: String, default: '' },
  isWin:          { type: Boolean, required: true },
  completedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameResult', gameResultSchema);
