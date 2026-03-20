const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentName: { 
        type: String, 
        required: true,
        trim: true
    },
    studentLastName: { 
        type: String, 
        required: true,
        trim: true
    },
    studentCity: { 
        type: String, 
        trim: true
    },
    totalTests: { 
        type: Number, 
        default: 0 
    },
    avgScore: { 
        type: Number, 
        default: 0 
    },
    lastActivity: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Index for unique students
studentSchema.index({ studentName: 1, studentLastName: 1, studentCity: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
