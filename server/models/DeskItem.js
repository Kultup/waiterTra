const mongoose = require('mongoose');

const deskItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { type: String, default: 'note' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeskItem', deskItemSchema);
