const request = require('supertest');
const express = require('express');

jest.mock('../middleware/authMiddleware', () => ({
    auth: (req, res, next) => {
        req.user = {
            _id: 'user-1',
            role: 'superadmin',
            city: 'Kyiv',
            platform: ''
        };
        next();
    },
    checkRole: () => (req, res, next) => next()
}));

jest.mock('../utils/platformFilter', () => ({
    buildBaseFilter: jest.fn(() => ({})),
    buildOwnerQuery: jest.fn((user, id) => ({ _id: id, ownerId: user._id })),
    buildResultFilter: jest.fn(async () => ({ ownerId: 'allowed-owner' }))
}));

jest.mock('../utils/studentSync', () => ({
    syncStudent: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/PageView', () => ({
    create: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/Quiz', () => {
    const Quiz = jest.fn(function Quiz(data) {
        Object.assign(this, data);
        this._id = this._id || 'quiz-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    Quiz.find = jest.fn();
    Quiz.findOne = jest.fn();
    Quiz.findOneAndUpdate = jest.fn();
    Quiz.findOneAndDelete = jest.fn();

    return Quiz;
});

jest.mock('../models/QuizLink', () => {
    const QuizLink = jest.fn(function QuizLink(data) {
        Object.assign(this, data);
        this._id = this._id || 'link-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    QuizLink.findOne = jest.fn();

    return QuizLink;
});

jest.mock('../models/QuizResult', () => {
    const QuizResult = jest.fn(function QuizResult(data) {
        Object.assign(this, data);
        this._id = this._id || 'result-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    QuizResult.find = jest.fn();
    QuizResult.findOneAndUpdate = jest.fn();

    return QuizResult;
});

const Quiz = require('../models/Quiz');
const QuizLink = require('../models/QuizLink');
const QuizResult = require('../models/QuizResult');
const { buildResultFilter } = require('../utils/platformFilter');
const quizRouter = require('../routes/quiz');

const createQuery = (value) => {
    const query = {
        populate: jest.fn(() => query),
        sort: jest.fn(() => query),
        lean: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject)
    };

    return query;
};

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.set('io', { emit: jest.fn() });
    app.use('/api/quiz', quizRouter);
    return app;
};

describe('Quiz flow protections', () => {
    let app;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        buildResultFilter.mockResolvedValue({ ownerId: 'allowed-owner' });
    });

    it('rejects quiz creation when a question has fewer than two options', async () => {
        const response = await request(app)
            .post('/api/quiz')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Broken quiz',
                questions: [
                    {
                        text: 'Only one option',
                        options: ['Single'],
                        correctIndex: 0
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/2 варіанти/i);
        expect(Quiz).not.toHaveBeenCalled();
    });

    it('rejects quiz creation when passingScore is outside 0..100', async () => {
        const response = await request(app)
            .post('/api/quiz')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Broken score',
                passingScore: 150,
                questions: [
                    {
                        text: 'Question',
                        options: ['A', 'B'],
                        correctIndex: 0
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/0 до 100/i);
        expect(Quiz).not.toHaveBeenCalled();
    });

    it('submits quiz using stored answer indexes instead of reconstructing by option text', async () => {
        const link = {
            hash: 'quiz-hash',
            isUsed: false,
            ownerId: 'owner-1',
            attemptAnswers: [],
            quizId: {
                _id: 'quiz-1',
                ownerId: 'owner-1',
                passingScore: 70,
                questions: [
                    {
                        text: 'Pick the second identical option',
                        options: ['Same', 'Same'],
                        correctIndex: 1,
                        explanation: 'Only the second slot is correct'
                    }
                ]
            },
            save: jest.fn().mockResolvedValue(undefined)
        };

        QuizLink.findOne
            .mockReturnValueOnce(createQuery(link))
            .mockReturnValueOnce(createQuery(link));

        const checkResponse = await request(app)
            .post('/api/quiz/check-answer')
            .send({ hash: 'quiz-hash', questionIndex: 0, answerIndex: 1 });

        expect(checkResponse.status).toBe(200);
        expect(checkResponse.body).toEqual(expect.objectContaining({
            isCorrect: true,
            correctIndex: 1
        }));
        expect(link.attemptAnswers).toEqual([
            expect.objectContaining({ questionIndex: 0, answerIndex: 1, isCorrect: true })
        ]);

        const submitResponse = await request(app)
            .post('/api/quiz/hash/quiz-hash/submit')
            .send({
                studentName: 'Ivan',
                studentLastName: 'Ivanov',
                studentCity: 'Kyiv',
                studentPosition: 'Waiter'
            });

        expect(submitResponse.status).toBe(200);
        expect(submitResponse.body).toEqual(expect.objectContaining({
            score: 1,
            total: 1,
            percentage: 100,
            passed: true
        }));
        expect(submitResponse.body.answers[0]).toEqual(expect.objectContaining({
            givenAnswer: 'Same',
            correctAnswer: 'Same',
            isCorrect: true
        }));
        expect(link.isUsed).toBe(true);
        expect(link.attemptAnswers).toEqual([]);
    });

    it('rejects changing an already stored answer for the same question', async () => {
        const link = {
            hash: 'quiz-hash',
            isUsed: false,
            attemptAnswers: [{ questionIndex: 0, answerIndex: 0, isCorrect: false }],
            quizId: {
                questions: [
                    {
                        text: 'Question',
                        options: ['A', 'B'],
                        correctIndex: 1,
                        explanation: 'B is correct'
                    }
                ]
            },
            save: jest.fn().mockResolvedValue(undefined)
        };

        QuizLink.findOne.mockReturnValue(createQuery(link));

        const response = await request(app)
            .post('/api/quiz/check-answer')
            .send({ hash: 'quiz-hash', questionIndex: 0, answerIndex: 1 });

        expect(response.status).toBe(409);
        expect(response.body.error).toBeTruthy();
        expect(link.save).not.toHaveBeenCalled();
    });

    it('patches quiz result city through the scoped query returned by buildResultFilter', async () => {
        QuizResult.findOneAndUpdate.mockReturnValue(createQuery({
            _id: 'result-1',
            studentCity: 'Lviv',
            city: 'Lviv',
            quizId: { title: 'Quiz title' }
        }));

        const response = await request(app)
            .patch('/api/quiz/results/result-1/city')
            .set('Authorization', 'Bearer test-token')
            .send({ city: 'Lviv' });

        expect(response.status).toBe(200);
        expect(buildResultFilter).toHaveBeenCalledWith(expect.objectContaining({ _id: 'user-1' }), 'studentCity');
        expect(QuizResult.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ ownerId: 'allowed-owner', _id: 'result-1' }),
            { studentCity: 'Lviv', city: 'Lviv' },
            { new: true }
        );
    });
});
