const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn()
}));

const mockTestSort = jest.fn();
const mockGameSort = jest.fn();
const mockQuizSort = jest.fn();
const mockComplexSort = jest.fn();
const mockQuizPopulate = jest.fn();
const mockComplexPopulate = jest.fn();

jest.mock('../models/TestResult', () => ({
    find: jest.fn().mockReturnValue({ sort: mockTestSort }),
    deleteMany: jest.fn()
}));

jest.mock('../models/GameResult', () => ({
    find: jest.fn().mockReturnValue({ sort: mockGameSort }),
    deleteMany: jest.fn()
}));

jest.mock('../models/QuizResult', () => ({
    find: jest.fn().mockReturnValue({
        sort: mockQuizSort,
        populate: mockQuizPopulate
    }),
    deleteMany: jest.fn()
}));

jest.mock('../models/ComplexTestResult', () => ({
    find: jest.fn().mockReturnValue({
        sort: mockComplexSort,
        populate: mockComplexPopulate
    }),
    deleteMany: jest.fn()
}));

jest.mock('../models/Student', () => ({
    deleteMany: jest.fn(),
    deleteOne: jest.fn()
}));

const User = require('../models/User');
const TestResult = require('../models/TestResult');
const GameResult = require('../models/GameResult');
const QuizResult = require('../models/QuizResult');
const ComplexTestResult = require('../models/ComplexTestResult');
const Student = require('../models/Student');
const { buildStudentKey } = require('../utils/studentAccess');

mockQuizPopulate.mockReturnValue({ sort: mockQuizSort });
mockComplexPopulate.mockReturnValue({ sort: mockComplexSort });

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/students', require('../routes/student'));
    app.use('/api/maintenance', require('../routes/maintenance'));
    return app;
};

describe('Student and maintenance isolation', () => {
    let app;
    const testSecret = 'test-secret-key';

    beforeAll(() => {
        app = createTestApp();
        process.env.JWT_SECRET = testSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockTestSort.mockResolvedValue([]);
        mockGameSort.mockResolvedValue([]);
        mockQuizSort.mockResolvedValue([]);
        mockComplexSort.mockResolvedValue([]);
        mockQuizPopulate.mockReturnValue({ sort: mockQuizSort });
        mockComplexPopulate.mockReturnValue({ sort: mockComplexSort });
        TestResult.deleteMany.mockResolvedValue({ deletedCount: 0 });
        GameResult.deleteMany.mockResolvedValue({ deletedCount: 0 });
        QuizResult.deleteMany.mockResolvedValue({ deletedCount: 0 });
        ComplexTestResult.deleteMany.mockResolvedValue({ deletedCount: 0 });
        Student.deleteMany.mockResolvedValue({ deletedCount: 0 });
        Student.deleteOne.mockResolvedValue({ deletedCount: 0 });
    });

    it('keeps admin student list owner-scoped', async () => {
        const token = jwt.sign({ _id: 'admin-1' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'admin-1',
            username: 'admin_one',
            role: 'admin',
            city: 'Львів',
            isBlocked: false,
            platform: ''
        });

        mockTestSort.mockResolvedValue([
            {
                studentName: 'Іра',
                studentLastName: 'Коваль',
                studentCity: 'Київ',
                score: 8,
                total: 10,
                percentage: 80,
                completedAt: '2026-04-01T10:00:00.000Z'
            }
        ]);

        const res = await request(app)
            .get('/api/students')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(TestResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'admin-1' }));
        expect(GameResult.find).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'admin-1' }));
        expect(res.body).toEqual([
            expect.objectContaining({
                studentName: 'Іра',
                studentLastName: 'Коваль',
                studentCity: 'Київ',
                totalTests: 1,
                avgScore: 80
            })
        ]);
    });

    it('blocks viewer from student and maintenance routes', async () => {
        const token = jwt.sign({ _id: 'viewer-1' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'viewer-1',
            username: 'viewer_city',
            role: 'viewer',
            city: 'Львів',
            isBlocked: false,
            platform: ''
        });

        const studentsRes = await request(app)
            .get('/api/students')
            .set('Authorization', `Bearer ${token}`);
        expect(studentsRes.statusCode).toBe(403);

        const maintenanceRes = await request(app)
            .get('/api/maintenance/students')
            .set('Authorization', `Bearer ${token}`);
        expect(maintenanceRes.statusCode).toBe(403);

        expect(TestResult.find).not.toHaveBeenCalled();
    });

    it('returns owner-scoped student profile history', async () => {
        const token = jwt.sign({ _id: 'admin-2' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'admin-2',
            username: 'admin_two',
            role: 'admin',
            city: 'Київ',
            isBlocked: false,
            platform: ''
        });

        const studentId = buildStudentKey({
            studentName: 'Олег',
            studentLastName: 'Тест',
            studentCity: 'Київ'
        });

        mockGameSort.mockResolvedValue([
            {
                scenarioTitle: 'Сценарій',
                studentName: 'Олег',
                studentLastName: 'Тест',
                city: 'Київ',
                isWin: true,
                completedAt: '2026-04-01T12:00:00.000Z'
            }
        ]);

        const res = await request(app)
            .get(`/api/students/${studentId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(GameResult.find).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'admin-2',
            studentName: 'Олег',
            studentLastName: 'Тест',
            city: 'Київ'
        }));
        expect(res.body.student).toEqual(expect.objectContaining({
            studentName: 'Олег',
            studentLastName: 'Тест',
            studentCity: 'Київ',
            totalTests: 1,
            avgScore: 100
        }));
        expect(res.body.history[0]).toEqual(expect.objectContaining({
            type: 'game',
            score: 1,
            total: 1,
            percentage: 100,
            passed: true
        }));
    });

    it('uses owner-scoped city reset for admin', async () => {
        const token = jwt.sign({ _id: 'admin-3' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'admin-3',
            username: 'admin_three',
            role: 'admin',
            city: 'Київ',
            isBlocked: false,
            platform: ''
        });

        TestResult.deleteMany.mockResolvedValue({ deletedCount: 2 });
        GameResult.deleteMany.mockResolvedValue({ deletedCount: 1 });

        const res = await request(app)
            .delete('/api/maintenance/reset/city')
            .set('Authorization', `Bearer ${token}`)
            .send({ city: 'Київ' });

        expect(res.statusCode).toBe(200);
        expect(TestResult.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'admin-3',
            studentCity: 'Київ'
        }));
        expect(GameResult.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'admin-3',
            city: 'Київ'
        }));
        expect(Student.deleteMany).not.toHaveBeenCalled();
    });

    it('uses owner-scoped student reset for admin', async () => {
        const token = jwt.sign({ _id: 'admin-4' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'admin-4',
            username: 'admin_four',
            role: 'admin',
            city: 'Київ',
            isBlocked: false,
            platform: ''
        });

        const res = await request(app)
            .delete('/api/maintenance/reset/student')
            .set('Authorization', `Bearer ${token}`)
            .send({
                studentName: 'Олег',
                studentLastName: 'Тест',
                studentCity: 'Львів'
            });

        expect(res.statusCode).toBe(200);
        expect(TestResult.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'admin-4',
            studentName: 'Олег',
            studentLastName: 'Тест',
            studentCity: 'Львів'
        }));
        expect(GameResult.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
            ownerId: 'admin-4',
            studentName: 'Олег',
            studentLastName: 'Тест',
            city: 'Львів'
        }));
        expect(Student.deleteOne).not.toHaveBeenCalled();
    });

    it('blocks platform superadmin from global reset', async () => {
        const token = jwt.sign({ _id: 'super-fun' }, testSecret);
        User.findOne.mockResolvedValue({
            _id: 'super-fun',
            username: 'fun_admin',
            role: 'superadmin',
            city: '',
            isBlocked: false,
            platform: 'funadmin'
        });

        const res = await request(app)
            .delete('/api/maintenance/reset/all')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(403);
    });
});
