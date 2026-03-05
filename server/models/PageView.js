const mongoose = require('mongoose');

const pageViewSchema = new mongoose.Schema({
    testType: {
        type: String,
        enum: ['desk', 'multi-desk', 'game', 'quiz', 'complex'],
        required: true
    },
    hash: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    city: { type: String, default: '' },
    ip: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

pageViewSchema.index({ createdAt: -1 });
pageViewSchema.index({ ownerId: 1, createdAt: -1 });
pageViewSchema.index({ city: 1, createdAt: -1 });
pageViewSchema.index({ hash: 1 });
pageViewSchema.index({ testType: 1, createdAt: -1 });

module.exports = mongoose.model('PageView', pageViewSchema);
