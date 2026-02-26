const mongoose = require('mongoose');

const gameChoiceSchema = new mongoose.Schema({
  text:       { type: String, default: '' },
  nextNodeId: { type: String, default: null },
  isWin:      { type: Boolean, default: false },
  result:     { type: String, default: '' }
}, { _id: false });

const gameCharacterSchema = new mongoose.Schema({
  charId:      { type: String, required: true },
  name:        { type: String, required: true },
  avatar:      { type: String, default: '🧑' },
  color:       { type: String, default: '#38bdf8' },
  description: { type: String, default: '' }
}, { _id: false });

const gameNodeSchema = new mongoose.Schema({
  nodeId:    { type: String, required: true },
  text:      { type: String, default: '' },
  speakerId: { type: String, default: null },
  choices:   [gameChoiceSchema]
}, { _id: false });

const gameScenarioSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  characters:  [gameCharacterSchema],
  nodes:       [gameNodeSchema],
  startNodeId: { type: String, required: true },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameScenario', gameScenarioSchema);
