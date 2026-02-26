const mongoose = require('mongoose');

const deskTestSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeskTemplate', required: true },
  hash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeskTest', deskTestSchema);
