const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    city: { type: String, default: '' },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'trainer', 'viewer'],
        default: 'admin'
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
