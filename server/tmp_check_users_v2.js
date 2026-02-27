const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq');
        const users = await User.find({}).lean();
        console.log('--- DATABASE STATE ---');
        console.log('Total users:', users.length);
        console.log('Users list:', JSON.stringify(users, null, 2));
        await mongoose.disconnect();
    } catch (err) {
        console.error('Check failed:', err);
    }
}
check();
