const mongoose = require('mongoose');
require('dotenv').config();
const Student = require('../models/Student');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq';

async function syncAll() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all unique student identifiers from all models
        const allResults = [
            ...(await TestResult.find({}, 'studentName studentLastName studentCity score maxScore percentage')),
            ...(await GameResult.find({}, 'studentName studentLastName city score maxScore isWin score')).map(r => ({ ...r.toObject(), studentCity: r.city })),
            ...(await QuizResult.find({}, 'studentName studentLastName studentCity score maxScore percentage')),
            ...(await ComplexTestResult.find({}, 'studentName studentLastName studentCity steps overallPassed score'))
        ];

        const studentMap = new Map();

        allResults.forEach(r => {
            const key = `${r.studentName?.trim()}_${r.studentLastName?.trim()}_${r.studentCity?.trim() || ''}`.toLowerCase();
            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    studentName: r.studentName?.trim(),
                    studentLastName: r.studentLastName?.trim(),
                    studentCity: r.studentCity?.trim() || '',
                    results: []
                });
            }
            
            // Calculate percentage for this result
            let pct = 0;
            if (r.percentage !== undefined) {
                pct = r.percentage;
            } else if (r.maxScore > 0) {
                pct = (r.score / r.maxScore) * 100;
            } else if (r.overallPassed !== undefined) {
                pct = r.overallPassed ? 100 : 0;
            } else if (r.isWin !== undefined) {
                pct = r.isWin ? 100 : 0;
            }

            studentMap.get(key).results.push(pct);
        });

        console.log(`Found ${studentMap.size} unique students. Syncing...`);

        for (const [key, data] of studentMap.entries()) {
            const totalTests = data.results.length;
            const avgScore = Math.round(data.results.reduce((a, b) => a + b, 0) / totalTests);

            await Student.findOneAndUpdate(
                { 
                    studentName: data.studentName, 
                    studentLastName: data.studentLastName, 
                    studentCity: data.studentCity 
                },
                { 
                    totalTests, 
                    avgScore, 
                    lastActivity: new Date() // We don't have the exact last date here easily without sorting all, but it's a migration
                },
                { upsert: true }
            );
        }

        console.log('Sync completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

syncAll();
