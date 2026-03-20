const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String, default: '🍽️' },
  createdAt: { type: Date, default: Date.now },
  platform: { type: String, default: '' }
});

module.exports = mongoose.model('Dish', dishSchema);
