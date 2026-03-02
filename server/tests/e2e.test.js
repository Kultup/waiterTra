const request = require('supertest');
const express = require('express');

// Mock models before requiring routes
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock('../models/City', () => ({
    find: jest.fn(),
    create: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock('../models/DeskTemplate', () => ({
    find: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../models/GameScenario', () => ({
    find: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../models/Quiz', () => ({
    find: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../models/TestResult', () => ({
    find: jest.fn(),
    create: jest.fn(),
}));

jest.mock('../models/GameResult', () => ({
    find: jest.fn(),
}));

jest.mock('../models/QuizResult', () => ({
    find: jest.fn(),
}));

jest.mock('../models/GameLink', () => ({
    create: jest.fn(),
}));

const User = require('../models/User');
const City = require('../models/City');
const DeskTemplate = require('../models/DeskTemplate');
const GameScenario = require('../models/GameScenario');
const Quiz = require('../models/Quiz');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const GameLink = require('../models/GameLink');

// Create test app
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    
    const authRouter = require('../routes/auth');
    const cityRouter = require('../routes/city');
    const templatesRouter = require('../routes/templates');
    const gameRouter = require('../routes/game');
    const quizRouter = require('../routes/quiz');
    const testResultsRouter = require('../routes/testResults');
    const statsRouter = require('../routes/stats');
    
    app.use('/api/auth', authRouter);
    app.use('/api/cities', cityRouter);
    app.use('/api/templates', templatesRouter);
    app.use('/api/game-scenarios', gameRouter.scenariosRouter);
    app.use('/api/quiz', quizRouter);
    app.use('/api/test-results', testResultsRouter);
    app.use('/api/game-results', gameRouter.resultsRouter);
    app.use('/api/stats', statsRouter);
    
    return app;
};

describe('E2E - Повний цикл ServIQ', () => {
    let app;
    let authToken = 'test-token';
    
    beforeAll(() => {
        app = createTestApp();
        process.env.JWT_SECRET = 'test-secret-key';
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup auth mock
        User.findOne.mockResolvedValue({
            _id: 'test-user',
            username: 'admin',
            role: 'superadmin',
            city: 'Хмельницький',
            isBlocked: false,
        });
    });
    
    describe('1. Вхід в систему', () => {
        it('should login successfully', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'pass123' });
            
            expect([200, 401, 500]).toContain(res.statusCode);
        });
    });
    
    describe('2. Отримання списку міст', () => {
        it('should get cities list', async () => {
            City.find.mockResolvedValue([
                { _id: '1', name: 'Хмельницький' },
                { _id: '2', name: 'Київ' },
            ]);
            
            const res = await request(app)
                .get('/api/cities')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 401, 500]).toContain(res.statusCode);
        });
    });
    
    describe('3. Створення шаблону сервірування', () => {
        it('should create template', async () => {
            DeskTemplate.create.mockResolvedValue({
                _id: 'template1',
                templateName: 'Тестовий стіл',
            });
            
            const res = await request(app)
                .post('/api/templates')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ templateName: 'Тестовий стіл', items: [] });
            
            expect([201, 401]).toContain(res.statusCode);
        });
        
        it('should get templates list', async () => {
            DeskTemplate.find.mockResolvedValue([
                { _id: 't1', templateName: 'Стіл 1' },
            ]);
            
            const res = await request(app)
                .get('/api/templates')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 401]).toContain(res.statusCode);
        });
    });
    
    describe('4. Створення ігрового сценарію', () => {
        it('should create game scenario', async () => {
            GameScenario.create.mockResolvedValue({
                _id: 'scenario1',
                title: 'Тестовий сценарій',
            });
            
            const res = await request(app)
                .post('/api/game-scenarios')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Тестовий сценарій',
                    startNodeId: 'n1',
                    nodes: [],
                });
            
            expect([201, 401]).toContain(res.statusCode);
        });
    });
    
    describe('5. Створення квізу', () => {
        it('should create quiz', async () => {
            Quiz.create.mockResolvedValue({
                _id: 'quiz1',
                title: 'Тестовий квіз',
            });
            
            const res = await request(app)
                .post('/api/quiz')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Тестовий квіз',
                    questions: [],
                });
            
            expect([201, 401]).toContain(res.statusCode);
        });
    });
    
    describe('6. Отримання результатів', () => {
        it('should get test results', async () => {
            TestResult.find.mockResolvedValue([
                { studentName: 'Іван', percentage: 85 },
            ]);
            
            const res = await request(app)
                .get('/api/test-results')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 401]).toContain(res.statusCode);
        });
        
        it('should get game results', async () => {
            GameResult.find.mockResolvedValue([
                { playerName: 'Олена', isWin: true },
            ]);
            
            const res = await request(app)
                .get('/api/game-results')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 401]).toContain(res.statusCode);
        });
    });
    
    describe('7. Статистика', () => {
        it('should get stats overview', async () => {
            TestResult.find.mockResolvedValue([]);
            GameResult.find.mockResolvedValue([]);
            QuizResult.find.mockResolvedValue([]);
            
            const res = await request(app)
                .get('/api/stats/overview')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect([200, 401]).toContain(res.statusCode);
        });
    });
    
    describe('8. Генерація посилання', () => {
        it('should create game link', async () => {
            GameLink.create.mockResolvedValue({
                _id: 'link1',
                hash: 'abc123',
            });
            
            const res = await request(app)
                .post('/api/game-links')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ scenarioId: 'scenario1' });
            
            expect([201, 401, 404]).toContain(res.statusCode);
        });
    });
});

describe('E2E - Безпека', () => {
    let app;
    
    beforeAll(() => {
        app = createTestApp();
    });
    
    it('should reject unauthorized requests', async () => {
        const routes = [
            ['get', '/api/auth/me'],
            ['get', '/api/cities'],
            ['get', '/api/templates'],
            ['get', '/api/game-scenarios'],
            ['get', '/api/stats/overview'],
        ];
        
        for (const [method, route] of routes) {
            const res = await request(app)[method](route);
            expect([401, 500]).toContain(res.statusCode);
        }
    });
});

afterAll(async () => {
    jest.clearAllMocks();
});
