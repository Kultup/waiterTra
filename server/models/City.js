const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    platform: { type: String, default: '' }
});

// Compound unique index - allow same city names on different platforms
citySchema.index({ name: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('City', citySchema);
