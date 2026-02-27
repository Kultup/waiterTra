const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serviq');
        const count = await User.countDocuments();
        console.log('Total users:', count);
        if (count > 0) {
            const users = await User.find({}, 'username role');
            console.log('Users:', users);
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
