const mongoose = require('mongoose');

const gameLinkSchema = new mongoose.Schema({
  scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameScenario', required: true },
  hash:       { type: String, required: true, unique: true },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameLink', gameLinkSchema);
