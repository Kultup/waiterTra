const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

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
    findOne: jest.fn(),
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
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/DeskTest', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
    findOne: jest.fn(),
}));

jest.mock('../models/MultiDeskTest', () => ({
    find: jest.fn().mockReturnValue({ populate: mockPopulate }),
}));

jest.mock('../models/TestResult', () => ({
    find: jest.fn().mockReturnValue({ sort: mockSort }),
    findOneAndUpdate: jest.fn(),
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
    findOneAndUpdate: jest.fn(),
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

describe('Role and City Isolation', () => {
    let app;
    const testSecret = 'test-secret-key';
    const cities = ['Київ', 'Львів', 'Одеса'];

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

    describe('Admin resources are owner-scoped', () => {
        cities.forEach((cityName) => {
            it(`keeps ${cityName} admin on their own resources and results`, async () => {
                const userId = `user-${cityName}`;
                const token = jwt.sign({ _id: userId }, testSecret);
                User.findOne.mockResolvedValue({
                    _id: userId,
                    username: `admin_${cityName}`,
                    role: 'admin',
                    city: cityName,
                    isBlocked: false,
                    platform: ''
                });

                await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`);
                expect(DeskTemplate.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/quiz').set('Authorization', `Bearer ${token}`);
                expect(Quiz.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/game-scenarios').set('Authorization', `Bearer ${token}`);
                expect(GameScenario.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }), expect.any(String));

                await request(app).get('/api/complex-tests').set('Authorization', `Bearer ${token}`);
                expect(ComplexTest.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/tests').set('Authorization', `Bearer ${token}`);
                expect(DeskTest.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/tests/multi').set('Authorization', `Bearer ${token}`);
                expect(MultiDeskTest.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/test-results').set('Authorization', `Bearer ${token}`);
                expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/quiz/results').set('Authorization', `Bearer ${token}`);
                expect(QuizResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/game-results').set('Authorization', `Bearer ${token}`);
                expect(GameResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/complex-tests/results').set('Authorization', `Bearer ${token}`);
                expect(ComplexTestResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: userId }));

                await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${token}`);
                expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({
                    $and: expect.arrayContaining([
                        expect.objectContaining({ ownerId: userId })
                    ])
                }));
            });
        });
    });

    describe('Viewer can only read city-scoped results', () => {
        it('blocks viewer from editor routes', async () => {
            const token = jwt.sign({ _id: 'viewer-1' }, testSecret);
            User.findOne.mockResolvedValue({
                _id: 'viewer-1',
                username: 'viewer_kyiv',
                role: 'viewer',
                city: 'Київ',
                isBlocked: false,
                platform: ''
            });

            const templatesRes = await request(app).get('/api/templates').set('Authorization', `Bearer ${token}`);
            expect(templatesRes.statusCode).toBe(403);
            expect(DeskTemplate.find).not.toHaveBeenCalled();

            const quizRes = await request(app).get('/api/quiz').set('Authorization', `Bearer ${token}`);
            expect(quizRes.statusCode).toBe(403);
            expect(Quiz.find).not.toHaveBeenCalled();

            const testsRes = await request(app).get('/api/tests').set('Authorization', `Bearer ${token}`);
            expect(testsRes.statusCode).toBe(403);
            expect(DeskTest.find).not.toHaveBeenCalled();

            const statsRes = await request(app).get('/api/stats/overview').set('Authorization', `Bearer ${token}`);
            expect(statsRes.statusCode).toBe(403);
        });

        it('keeps viewer on city-only result queries', async () => {
            const token = jwt.sign({ _id: 'viewer-2' }, testSecret);
            User.findOne.mockResolvedValue({
                _id: 'viewer-2',
                username: 'viewer_lviv',
                role: 'viewer',
                city: 'Львів',
                isBlocked: false,
                platform: ''
            });

            const testResultsRes = await request(app).get('/api/test-results').set('Authorization', `Bearer ${token}`);
            expect(testResultsRes.statusCode).toBe(200);
            expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({ studentCity: 'Львів' }));

            const quizResultsRes = await request(app).get('/api/quiz/results').set('Authorization', `Bearer ${token}`);
            expect(quizResultsRes.statusCode).toBe(200);
            expect(QuizResult.find).toHaveBeenCalledWith(expect.objectContaining({ studentCity: 'Львів' }));

            const gameResultsRes = await request(app).get('/api/game-results').set('Authorization', `Bearer ${token}`);
            expect(gameResultsRes.statusCode).toBe(200);
            expect(GameResult.find).toHaveBeenCalledWith(expect.objectContaining({ city: 'Львів' }));

            const complexResultsRes = await request(app).get('/api/complex-tests/results').set('Authorization', `Bearer ${token}`);
            expect(complexResultsRes.statusCode).toBe(200);
            expect(ComplexTestResult.find).toHaveBeenCalledWith(expect.objectContaining({ studentCity: 'Львів' }));
        });
    });

    describe('Scoped updates stay owner-bound', () => {
        it('returns 404 for admin editing another owner template', async () => {
            const admin = { _id: 'admin-a', role: 'admin', city: 'Київ', platform: '' };
            const token = jwt.sign({ _id: 'admin-a' }, testSecret);
            User.findOne.mockResolvedValue(admin);
            DeskTemplate.findOneAndUpdate.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/templates/some-other-template-id')
                .set('Authorization', `Bearer ${token}`)
                .send({ templateName: 'Hacked' });

            expect(res.statusCode).toBe(404);
            expect(DeskTemplate.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ ownerId: 'admin-a' }),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('uses scoped query when patching test result city', async () => {
            const admin = { _id: 'admin-b', role: 'admin', city: 'Київ', platform: '' };
            const token = jwt.sign({ _id: 'admin-b' }, testSecret);
            User.findOne.mockResolvedValue(admin);
            TestResult.findOneAndUpdate.mockResolvedValue({ _id: 'result-1', studentCity: 'Київ' });

            const res = await request(app)
                .patch('/api/test-results/result-1/city')
                .set('Authorization', `Bearer ${token}`)
                .send({ city: 'Київ' });

            expect(res.statusCode).toBe(200);
            expect(TestResult.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ _id: 'result-1', ownerId: 'admin-b' }),
                expect.any(Object),
                expect.any(Object)
            );
        });
    });
});
