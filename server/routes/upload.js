const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/authMiddleware');

// Uploads directory (created in index.js)
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm', 'video/mpeg', 'video/quicktime'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Дозволені тільки зображення та відео!'));
        }
    }
});

// Upload endpoint
router.post('/', auth, upload.single('file'), (req, res) => {
    console.log('Upload request:', {
        file: req.file ? {
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: req.file.path
        } : null,
        user: req.user
    });
    
    if (!req.file) {
        console.error('No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log('File uploaded:', fileUrl);
    res.json({ url: fileUrl });
});

// Error handling middleware for upload errors
router.use((err, req, res, next) => {
    console.error('Upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Файл занадто великий (макс. 500MB)' });
    }
    res.status(500).json({ error: err.message });
});

module.exports = router;
