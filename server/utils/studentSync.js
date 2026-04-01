const Student = require('../models/Student');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const logger = require('./logger');

const normalizePercentage = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const getComplexPercentage = (result) => {
    const steps = Array.isArray(result.steps) ? result.steps : [];
    if (steps.length === 0) {
        return result.overallPassed ? 100 : 0;
    }

    const stepsWithTotals = steps.filter((step) => Number(step.total) > 0);
    if (stepsWithTotals.length > 0) {
        const totalScore = stepsWithTotals.reduce((sum, step) => sum + Number(step.score || 0), 0);
        const total = stepsWithTotals.reduce((sum, step) => sum + Number(step.total || 0), 0);
        return total > 0 ? Math.round((totalScore / total) * 100) : 0;
    }

    const averageStepPercentage = steps.reduce((sum, step) => sum + normalizePercentage(step.percentage), 0) / steps.length;
    return Math.round(averageStepPercentage);
};

const getResultPercentage = (result, type) => {
    if (type === 'game') {
        return result.isWin ? 100 : 0;
    }

    if (type === 'complex') {
        return getComplexPercentage(result);
    }

    if (Number.isFinite(Number(result.percentage))) {
        return Number(result.percentage);
    }

    const total = Number(result.total || 0);
    const score = Number(result.score || 0);
    return total > 0 ? Math.round((score / total) * 100) : 0;
};

/**
 * Updates student statistics based on all their results
 * @param {string} studentName 
 * @param {string} studentLastName 
 * @param {string} studentCity 
 * @param {object} io - Socket.io instance
 * @param {object} newResult - The result that was just added
 */
async function syncStudent(studentName, studentLastName, studentCity, io, newResult) {
    try {
        const query = { 
            studentName: studentName.trim(), 
            studentLastName: studentLastName.trim(), 
            studentCity: studentCity ? studentCity.trim() : '' 
        };

        const [testRes, gameRes, quizRes, complexRes] = await Promise.all([
            TestResult.find(query, 'score total percentage completedAt'),
            GameResult.find({ studentName: query.studentName, studentLastName: query.studentLastName, city: query.studentCity }, 'isWin completedAt'),
            QuizResult.find(query, 'score total percentage completedAt'),
            ComplexTestResult.find(query, 'steps overallPassed completedAt')
        ]);

        const allResults = [
            ...testRes.map((result) => ({ type: 'desk', result })),
            ...gameRes.map((result) => ({ type: 'game', result })),
            ...quizRes.map((result) => ({ type: 'quiz', result })),
            ...complexRes.map((result) => ({ type: 'complex', result }))
        ];
        const totalTests = allResults.length;
        
        const totalScorePct = allResults.reduce((sum, entry) => (
            sum + getResultPercentage(entry.result, entry.type)
        ), 0);
        const avgScore = totalTests > 0 ? Math.round(totalScorePct / totalTests) : 0;
        const lastActivity = allResults.reduce((latest, entry) => {
            const completedAt = entry.result?.completedAt ? new Date(entry.result.completedAt) : null;
            if (!completedAt || Number.isNaN(completedAt.getTime())) {
                return latest;
            }
            return !latest || completedAt > latest ? completedAt : latest;
        }, null) || new Date();

        await Student.findOneAndUpdate(
            { studentName: query.studentName, studentLastName: query.studentLastName, studentCity: query.studentCity },
            { 
                totalTests, 
                avgScore, 
                lastActivity
            },
            { upsert: true, new: true }
        );

        // Emit real-time notification
        if (io) {
            // Emit the result to the administrative rooms for real-time updates
            const city = (studentCity || newResult?.playerCity || newResult?.city || '').toLowerCase();
            if (city) {
                io.to(`city:${city}`).emit('NEW_RESULT', newResult);
            }
            io.to('admin').emit('NEW_RESULT', newResult);
            logger.info(`Emitted NEW_RESULT for ${studentLastName}`);
        }

    } catch (err) {
        logger.error('Error syncing student stats:', err);
    }
}

module.exports = { syncStudent };
