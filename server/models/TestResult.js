const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    templateName: { type: String, required: true },
    studentName: { type: String, required: true },
    studentLastName: { type: String, default: '' },
    studentCity: { type: String, default: '' },
    studentPosition: { type: String, default: '' },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    userItems: [{ type: mongoose.Schema.Types.Mixed }],
    targetItems: [{ type: mongoose.Schema.Types.Mixed }],
    // legacy fields kept for backward compatibility
    hash: { type: String },
    totalItems: { type: Number },
    correctItems: { type: Number },
    timeSpent: { type: Number },
    city: { type: String, default: '' },
    completedAt: { type: Date, default: Date.now }
});

testResultSchema.index({ ownerId: 1, completedAt: -1 });
testResultSchema.index({ templateName: 1 });
testResultSchema.index({ studentCity: 1, completedAt: -1 });

module.exports = mongoose.model('TestResult', testResultSchema);
