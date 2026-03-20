const Student = require('../models/Student');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const logger = require('./logger');

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
            TestResult.find(query, 'score maxScore'),
            GameResult.find({ studentName: query.studentName, studentLastName: query.studentLastName, city: query.studentCity }, 'score maxScore'),
            QuizResult.find(query, 'score maxScore'),
            ComplexTestResult.find(query, 'score maxScore')
        ]);

        const allResults = [...testRes, ...gameRes, ...quizRes, ...complexRes];
        const totalTests = allResults.length;
        
        let totalScorePct = 0;
        allResults.forEach(r => {
            const pct = r.maxScore > 0 ? (r.score / r.maxScore) * 100 : 0;
            totalScorePct += pct;
        });

        const avgScore = totalTests > 0 ? Math.round(totalScorePct / totalTests) : 0;

        await Student.findOneAndUpdate(
            { studentName: query.studentName, studentLastName: query.studentLastName, studentCity: query.studentCity },
            { 
                totalTests, 
                avgScore, 
                lastActivity: new Date() 
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
