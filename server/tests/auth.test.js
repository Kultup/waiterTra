const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock models
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    countDocuments: jest.fn(),
}));

const User = require('../models/User');

// Create test app without starting server
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    
    const authRouter = require('../routes/auth');
    app.use('/api/auth', authRouter);
    
    return app;
};

describe('Auth API', () => {
    let app;
    
    beforeAll(() => {
        app = createTestApp();
        process.env.JWT_SECRET = 'test-secret';
    });

    describe('POST /api/auth/login', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should return 401 for missing credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'test123' });
            
            // Without validation middleware, returns 401 for non-existent user
            expect(res.statusCode).toBe(401);
        });

        it('should return 401 for missing password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser' });
            
            expect(res.statusCode).toBe(401);
        });

        it('should return 401 for non-existent user', async () => {
            User.findOne.mockResolvedValue(null);
            
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent', password: 'wrongpass' });
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBeDefined();
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return 401 without token', async () => {
            const res = await request(app)
                .get('/api/auth/me');
            
            expect(res.statusCode).toBe(401);
        });
    });
});

afterAll(async () => {
    jest.clearAllMocks();
});
