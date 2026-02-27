const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq');

        const count = await User.countDocuments();
        if (count > 0) {
            console.log('Database already has users. Seeding skipped.');
            process.exit(0);
        }

        const username = 'admin';
        const password = 'admin123';
        const passwordHash = await bcrypt.hash(password, 8);

        const admin = new User({
            username,
            passwordHash,
            role: 'superadmin'
        });

        await admin.save();
        console.log(`Initial superadmin created: ${username} / ${password}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during seeding:', err);
        process.exit(1);
    }
}
seed();
