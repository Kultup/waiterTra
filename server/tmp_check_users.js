const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq');
        const count = await User.countDocuments();
        console.log('Total users:', count);
        if (count > 0) {
            const users = await User.find({}, 'username role').lean();
            console.log('Users found:', JSON.stringify(users, null, 2));
        } else {
            console.log('No users found in database.');
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during check:', err);
    }
}
check();
