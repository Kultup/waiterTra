const request = require('supertest');
const express = require('express');

// Mock models
jest.mock('../models/TestResult', () => ({}));
jest.mock('../models/GameResult', () => ({}));
jest.mock('../models/QuizResult', () => ({}));

// Create test app without starting server
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: 'Please authenticate.' });
        }
        req.user = { role: 'superadmin', city: 'TestCity' };
        next();
    });
    
    const statsRouter = require('../routes/stats');
    app.use('/api/stats', statsRouter);
    
    return app;
};

describe('Stats API', () => {
    let app;
    
    beforeAll(() => {
        app = createTestApp();
    });

    describe('GET /api/stats/overview', () => {
        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/api/stats/overview');
            
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET /api/stats/cities', () => {
        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/api/stats/cities');
            
            expect(res.statusCode).toBe(401);
        });
    });
});

afterAll(async () => {
    jest.clearAllMocks();
});
