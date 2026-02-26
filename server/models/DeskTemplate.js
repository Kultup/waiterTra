const mongoose = require('mongoose');

const deskTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  items: [{
    name: { type: String, required: true },
    icon: { type: String },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: { type: String }
  }],
  timeLimit: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeskTemplate', deskTemplateSchema);
