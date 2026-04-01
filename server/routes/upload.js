const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { MEDIA_EDITOR_ROLES } = require('../utils/accessPolicy');
const logger = require('../utils/logger');

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
router.post('/', auth, checkRole(MEDIA_EDITOR_ROLES), upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileUrl = `/api/uploads/${req.file.filename}`;

    try {
        // If it's an image, optimize it
        if (req.file.mimetype.startsWith('image/')) {
            const tempPath = filePath + '_tmp';
            
            await sharp(filePath)
                .resize({
                    width: 1200,
                    height: 1200,
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toFormat('webp', { quality: 80 })
                .toFile(tempPath);

            // Replace original with optimized (webp) but keep original extension name for simplicity in DB
            // OR change filename to .webp. Let's keep original extension but contents are optimized.
            // Actually, keep original format but optimize.
            
            const isPng = req.file.mimetype === 'image/png';
            
            let sharpOp = sharp(filePath)
                .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true });
            
            if (isPng) {
                await sharpOp.png({ quality: 80, compressionLevel: 9 }).toFile(tempPath);
            } else {
                await sharpOp.jpeg({ quality: 80, progressive: true }).toFile(tempPath);
            }

            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
            
            logger.info(`Optimized image ${req.file.filename}`);
        }

        res.json({ url: fileUrl });
    } catch (err) {
        logger.error('Optimization error:', err);
        // Still return the original if optimization fails
        res.json({ url: fileUrl });
    }
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
