const mongoose = require('mongoose');

const deskTestSchema = new mongoose.Schema({
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeskTemplate', required: true },
    templateName: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    city: { type: String, default: '' },
    timeLimit: { type: Number, default: 300 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
});

deskTestSchema.index({ city: 1, isActive: 1 });

module.exports = mongoose.model('DeskTest', deskTestSchema);
