const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUpload() {
    try {
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        const token = loginRes.data.token;

        // Create a dummy image file
        const filePath = path.join(__dirname, 'dummy.png');
        fs.writeFileSync(filePath, 'dummy image content');

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const uploadRes = await axios.post('http://localhost:5000/api/upload', form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Upload OK:', uploadRes.data.url);
        fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Upload Failed:', err.response ? err.response.data : err.message);
    }
}

testUpload();
