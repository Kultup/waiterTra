const mongoose = require('mongoose');

const multiDeskTestSchema = new mongoose.Schema({
    templateIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DeskTemplate', required: true }],
    hash: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetCity: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MultiDeskTest', multiDeskTestSchema);
