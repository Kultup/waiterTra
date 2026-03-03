const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    hash: { type: String, required: true },
    studentName: { type: String, required: true },
    score: { type: Number, required: true },
    totalItems: { type: Number, required: true },
    correctItems: { type: Number, required: true },
    timeSpent: { type: Number },
    city: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    completedAt: { type: Date, default: Date.now }
});

testResultSchema.index({ hash: 1 });
testResultSchema.index({ templateName: 1 });
testResultSchema.index({ city: 1, completedAt: -1 });

module.exports = mongoose.model('TestResult', testResultSchema);
