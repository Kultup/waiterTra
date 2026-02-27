const mongoose = require('mongoose');

const complexStepResultSchema = new mongoose.Schema({
    type: { type: String, enum: ['desk', 'game', 'quiz'], required: true },
    title: { type: String, default: '' },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false }
}, { _id: false });

const complexTestResultSchema = new mongoose.Schema({
    complexTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplexTest', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentName: { type: String, required: true },
    studentLastName: { type: String, required: true },
    studentCity: { type: String, required: true },
    steps: [complexStepResultSchema],
    overallPassed: { type: Boolean, default: false },
    completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ComplexTestResult', complexTestResultSchema);
