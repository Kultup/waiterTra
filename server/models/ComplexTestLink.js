const mongoose = require('mongoose');

const complexTestLinkSchema = new mongoose.Schema({
    complexTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplexTest', required: true },
    hash: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ComplexTestLink', complexTestLinkSchema);
