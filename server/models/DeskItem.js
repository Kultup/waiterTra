const mongoose = require('mongoose');

const deskItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String },
  type: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, default: 40 },
  height: { type: Number, default: 40 },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: 0 },
  image: { type: String },
  category: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeskItem', deskItemSchema);
