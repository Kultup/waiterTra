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

jest.mock('../models/GameScenario', () => {
    const GameScenario = jest.fn(function GameScenario(data) {
        Object.assign(this, data);
        this._id = this._id || 'scenario-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    GameScenario.find = jest.fn();
    GameScenario.findOne = jest.fn();
    GameScenario.findById = jest.fn();
    GameScenario.findOneAndUpdate = jest.fn();
    GameScenario.findOneAndDelete = jest.fn();

    return GameScenario;
});

jest.mock('../models/GameLink', () => {
    const GameLink = jest.fn(function GameLink(data) {
        Object.assign(this, data);
        this._id = this._id || 'link-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    GameLink.findOne = jest.fn();

    return GameLink;
});

jest.mock('../models/GameResult', () => {
    const GameResult = jest.fn(function GameResult(data) {
        Object.assign(this, data);
        this._id = this._id || 'result-doc-1';
        this.save = jest.fn().mockResolvedValue(this);
    });

    GameResult.find = jest.fn();
    GameResult.findOneAndUpdate = jest.fn();

    return GameResult;
});

const GameScenario = require('../models/GameScenario');
const GameLink = require('../models/GameLink');
const GameResult = require('../models/GameResult');
const { buildResultFilter } = require('../utils/platformFilter');
const gameRouter = require('../routes/game');

const createQuery = (value) => {
    const query = {
        populate: jest.fn(() => query),
        sort: jest.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
        catch: (reject) => Promise.resolve(value).catch(reject)
    };

    return query;
};

const createApp = () => {
    const app = express();
    app.use(express.json());
    app.set('io', { emit: jest.fn() });
    app.use('/api/game-scenarios', gameRouter.scenariosRouter);
    app.use('/api/game-links', gameRouter.linksRouter);
    app.use('/api/game-results', gameRouter.resultsRouter);
    return app;
};

describe('Visual game editor flow', () => {
    let app;

    beforeAll(() => {
        app = createApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        buildResultFilter.mockResolvedValue({ ownerId: 'allowed-owner' });
    });

    it('stores the fields used by VisualGameBuilder when creating a scenario', async () => {
        const response = await request(app)
            .post('/api/game-scenarios')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Scenario title',
                description: 'Scenario description',
                targetCity: 'Kyiv',
                startNodeId: 'n1',
                characters: [
                    { charId: 'ch1', name: 'Host', avatar: '🙂', color: '#38bdf8', description: 'Front desk' }
                ],
                nodes: [
                    {
                        nodeId: 'n1',
                        text: 'Greeting',
                        speakerId: 'ch1',
                        x: 120,
                        y: 240,
                        choices: [
                            { choiceId: 'c1', text: 'Say hello', nextNodeId: null, isWin: true, result: 'Done' }
                        ]
                    }
                ]
            });

        expect(response.status).toBe(201);
        expect(GameScenario).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Scenario title',
            targetCity: 'Kyiv',
            startNodeId: 'n1',
            ownerId: 'user-1',
            characters: [
                expect.objectContaining({ charId: 'ch1', name: 'Host', avatar: '🙂', color: '#38bdf8' })
            ],
            nodes: [
                expect.objectContaining({
                    nodeId: 'n1',
                    speakerId: 'ch1',
                    x: 120,
                    y: 240,
                    choices: [expect.objectContaining({ choiceId: 'c1', text: 'Say hello' })]
                })
            ]
        }));
    });

    it('rejects a scenario when startNodeId is missing from the nodes list', async () => {
        const response = await request(app)
            .post('/api/game-scenarios')
            .set('Authorization', 'Bearer test-token')
            .send({
                title: 'Broken scenario',
                startNodeId: 'missing',
                nodes: [
                    {
                        nodeId: 'n1',
                        text: 'Greeting',
                        choices: []
                    }
                ]
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/Стартовий вузол/i);
        expect(GameScenario).not.toHaveBeenCalled();
    });

    it('returns a playable fallback start node for an older broken scenario', async () => {
        GameLink.findOne.mockReturnValue(createQuery({
            hash: 'hash-1',
            ownerId: 'owner-1',
            isUsed: false,
            isActive: true,
            scenarioId: {
                _id: 'scenario-1',
                title: 'Scenario title',
                targetCity: 'Kyiv',
                startNodeId: 'missing',
                nodes: [{ nodeId: 'n1', text: 'Greeting', choices: [] }]
            }
        }));

        const response = await request(app).get('/api/game-links/hash-1');

        expect(response.status).toBe(200);
        expect(response.body.city).toBe('Kyiv');
        expect(response.body.scenarioId.startNodeId).toBe('n1');
    });

    it('submits a game result using hash-linked scenario resolution and structured choicePath', async () => {
        const link = {
            hash: 'hash-1',
            ownerId: 'owner-1',
            isUsed: false,
            isActive: true,
            scenarioId: {
                _id: 'scenario-1',
                ownerId: 'owner-1',
                title: 'Stored scenario title'
            },
            save: jest.fn().mockResolvedValue(undefined)
        };

        GameLink.findOne.mockReturnValue(createQuery(link));

        const response = await request(app)
            .post('/api/game-results')
            .send({
                hash: 'hash-1',
                scenarioTitle: 'Wrong title from client',
                playerName: 'Ivan',
                playerLastName: 'Ivanov',
                playerCity: 'Kyiv',
                playerPosition: 'Waiter',
                endingTitle: 'Win',
                isWin: true,
                choicePath: [{ nodeText: 'Greeting', choiceText: 'Say hello' }]
            });

        expect(response.status).toBe(201);
        expect(GameScenario.findOne).not.toHaveBeenCalled();
        expect(GameResult).toHaveBeenCalledWith(expect.objectContaining({
            scenarioId: 'scenario-1',
            ownerId: 'owner-1',
            scenarioTitle: 'Stored scenario title',
            choicePath: [{ nodeText: 'Greeting', choiceText: 'Say hello' }]
        }));
        expect(link.isUsed).toBe(true);
        expect(link.save).toHaveBeenCalled();
    });

    it('patches game result city through the scoped result filter', async () => {
        GameResult.findOneAndUpdate.mockReturnValue(createQuery({
            _id: 'result-1',
            city: 'Lviv'
        }));

        const response = await request(app)
            .patch('/api/game-results/result-1/city')
            .set('Authorization', 'Bearer test-token')
            .send({ city: 'Lviv' });

        expect(response.status).toBe(200);
        expect(buildResultFilter).toHaveBeenCalledWith(expect.objectContaining({ _id: 'user-1' }), 'city');
        expect(GameResult.findOneAndUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ ownerId: 'allowed-owner', _id: 'result-1' }),
            { city: 'Lviv' },
            { new: true }
        );
    });
});
