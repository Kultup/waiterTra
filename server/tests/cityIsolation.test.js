const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock models before requiring routes
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
}));

const mockSort = jest.fn().mockResolvedValue([]);
const mockPopulate = jest.fn().mockReturnValue({
    sort: mockSort,
    populate: jest.fn().mockReturnValue({ sort: mockSort })
});
const mockDistinct = jest.fn().mockResolvedValue([]);

jest.mock('../models/DeskTemplate', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/Quiz', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/QuizResult', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
    distinct: mockDistinct,
}));

jest.mock('../models/GameScenario', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/GameResult', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    distinct: mockDistinct,
}));

jest.mock('../models/DeskTest', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
}));

jest.mock('../models/MultiDeskTest', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
}));

jest.mock('../models/TestResult', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    distinct: mockDistinct,
}));

jest.mock('../models/ComplexTest', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/ComplexTestResult', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
}));

const User = require('../models/User');
const DeskTemplate = require('../models/DeskTemplate');
const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const GameScenario = require('../models/GameScenario');
const GameResult = require('../models/GameResult');
const DeskTest = require('../models/DeskTest');
const MultiDeskTest = require('../models/MultiDeskTest');
const TestResult = require('../models/TestResult');
const ComplexTest = require('../models/ComplexTest');
const ComplexTestResult = require('../models/ComplexTestResult');

const createTestApp = () => {
    const app = express();
    app.use(express.json());

    app.use('/api/templates', require('../routes/templates'));
    app.use('/api/quiz', require('../routes/quiz'));
    const gameRouter = require('../routes/game');
    app.use('/api/game-scenarios', gameRouter.scenariosRouter);
    app.use('/api/game-results', gameRouter.resultsRouter);
    app.use('/api/tests', require('../routes/tests'));
    app.use('/api/test-results', require('../routes/testResults'));
    app.use('/api/complex-tests', require('../routes/complexTest'));
    app.use('/api/stats', require('../routes/stats'));

    return app;
};

describe('Exhaustive City Isolation Tests', () => {
    let app;
    const testSecret = 'test-secret-key';
    const cities = [
        'Хмельницький', 'Київ', 'Львів', 'Одеса', 'Харків',
        'Дніпро', 'Вінниця', 'Тернопіль', 'Івано-Франківськ',
        'Чернівці', 'Рівне', 'Луцьк', 'Житомир'
    ];

    beforeAll(() => {
        app = createTestApp();
        process.env.JWT_SECRET = testSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockSort.mockResolvedValue([]);
        mockPopulate.mockReturnValue({ sort: mockSort });
        mockDistinct.mockResolvedValue([]);
    });

    cities.forEach(cityName => {
        describe(`Isolation for ${cityName} Admin`, () => {
            const userId = `user-${cityName}`;
            const token = jwt.sign({ _id: userId }, testSecret);
            const mockUser = {
                _id: userId,
                username: `admin_${cityName}`,
                role: 'admin',
                city: cityName,
                isBlocked: false,
            };

            beforeEach(() => {
                User.findOne.mockResolvedValue(mockUser);
            });

            // 1. Resources Isolation
            it('should isolate DeskTemplates by targetCity OR ownerId', async () => {
                await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`);
                expect(DeskTemplate.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ targetCity: cityName })
                    ])
                }));
            });

            it('should isolate Quizzes by city OR ownerId', async () => {
                await request(app).get('/api/quiz').set('Authorization', `Bearer ${token}`);
                expect(Quiz.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ city: cityName })
                    ])
                }));
            });

            it('should isolate GameScenarios by targetCity OR ownerId', async () => {
                await request(app).get('/api/game-scenarios').set('Authorization', `Bearer ${token}`);
                expect(GameScenario.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ targetCity: cityName })
                    ])
                }), expect.any(String));
            });

            it('should isolate ComplexTests by targetCity OR ownerId', async () => {
                await request(app).get('/api/complex-tests').set('Authorization', `Bearer ${token}`);
                expect(ComplexTest.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ targetCity: cityName })
                    ])
                }));
            });

            // 2. Tests Isolation
            it('should isolate DeskTests and MultiDeskTests by targetCity OR ownerId', async () => {
                await request(app).get('/api/tests').set('Authorization', `Bearer ${token}`);
                expect(DeskTest.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ targetCity: cityName })
                    ])
                }));

                await request(app).get('/api/tests/multi').set('Authorization', `Bearer ${token}`);
                expect(MultiDeskTest.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ targetCity: cityName })
                    ])
                }));
            });

            // 3. Results Isolation
            it('should isolate Results (Test, Quiz, Game, Complex) by city/studentCity OR ownerId', async () => {
                // Test Results
                await request(app).get('/api/test-results').set('Authorization', `Bearer ${token}`);
                expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ studentCity: cityName })
                    ])
                }));

                // Quiz Results
                await request(app).get('/api/quiz/results').set('Authorization', `Bearer ${token}`);
                expect(QuizResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ studentCity: cityName })
                    ])
                }));

                // Game Results
                await request(app).get('/api/game-results').set('Authorization', `Bearer ${token}`);
                expect(GameResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ city: cityName })
                    ])
                }));

                // Complex Test Results
                await request(app).get('/api/complex-tests/results').set('Authorization', `Bearer ${token}`);
                expect(ComplexTestResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ studentCity: cityName })
                    ])
                }));
            });

            // 4. Stats Isolation
            it('should apply city isolation in Stats Overview', async () => {
                await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${token}`);
                // Verify that ONE of the filters contains the isolation OR
                expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $or: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId }),
                        expect.objectContaining({ studentCity: cityName })
                    ])
                }));
            });
        });
    });

    describe('Cross-City Data Leak Prevention', () => {
        it('should return 404/Ignore for Admin A trying to edit Admin B data', async () => {
            const adminA = { _id: 'admin-a', role: 'admin', city: 'Київ' };
            const tokenA = jwt.sign({ _id: 'admin-a' }, testSecret);
            User.findOne.mockResolvedValue(adminA);

            DeskTemplate.findOneAndUpdate.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/templates/some-other-template-id')
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ templateName: 'Hacked' });

            expect(res.statusCode).toBe(404);
            expect(DeskTemplate.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ ownerId: 'admin-a' }),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });
});
