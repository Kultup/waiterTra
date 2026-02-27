import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import API_URL from '../api';
import './GamePlay.css';

const GamePlay = () => {
    const { hash } = useParams();
    const [scenario, setScenario] = useState(null);
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [endResult, setEndResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [choicePath, setChoicePath] = useState([]);
    const [animKey, setAnimKey] = useState(0);
    const [loading, setLoading] = useState(true);

    // ── Registration ─────────────────────────────────────────────
    const [isRegistered, setIsRegistered] = useState(false);
    const [playerInfo, setPlayerInfo] = useState({
        firstName: '',
        lastName: '',
        city: '',
    });

    useEffect(() => {
        const fetchGame = async () => {
            try {
                const res = await axios.get(`${API_URL}/game-links/${hash}`);
                const sc = res.data.scenarioId;
                setScenario(sc);
                setCurrentNodeId(sc.startNodeId);
            } catch (err) {
                console.error('fetchGame:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchGame();
    }, [hash]);

    const currentNode = scenario?.nodes.find(n => n.nodeId === currentNodeId);

    const handleRegister = (e) => {
        e.preventDefault();
        if (playerInfo.firstName && playerInfo.lastName && playerInfo.city) {
            setIsRegistered(true);
        }
    };

    const handleChoice = async (choice) => {
        // Track the choice path for error analysis
        const nodeText = currentNode?.text ? currentNode.text.substring(0, 80) : '';
        setChoicePath(prev => [...prev, { nodeText, choiceText: choice.text }]);
        setHistory(prev => [...prev, currentNodeId]);
        setAnimKey(k => k + 1);

        if (!choice.nextNodeId) {
            setEndResult({ isWin: choice.isWin, result: choice.result, choiceText: choice.text });

            const endingTitle = choice.result
                ? choice.result.split('\n')[0].trim()
                : '';
            try {
                await axios.post(`${API_URL}/game-results`, {
                    hash,
                    scenarioTitle: scenario.title,
                    playerName: playerInfo.firstName,
                    playerLastName: playerInfo.lastName,
                    playerCity: playerInfo.city,
                    endingTitle,
                    isWin: choice.isWin,
                    choicePath: [...choicePath, { nodeText: nodeText, choiceText: choice.text }],
                });
            } catch (err) {
                console.error('saveGameResult:', err);
            }
        } else {
            setCurrentNodeId(choice.nextNodeId);
            setEndResult(null);
        }
    };

    const handleBack = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setHistory(h => h.slice(0, -1));
        setCurrentNodeId(prev);
        setEndResult(null);
        setAnimKey(k => k + 1);
    };

    const handleRestart = () => {
        setCurrentNodeId(scenario.startNodeId);
        setEndResult(null);
        setHistory([]);
        setChoicePath([]);
        setAnimKey(k => k + 1);
    };

    // ── Loading / error ──────────────────────────────────────────

    if (loading) return <div className="game-loading">Завантаження…</div>;
    if (!scenario) return <div className="game-loading">Гру не знайдено</div>;

    // ── Registration screen ──────────────────────────────────────

    if (!isRegistered) {
        return (
            <div className="game-registration">
                <div className="game-reg-card">
                    <div className="game-reg-header">
                        <span className="game-reg-icon">🎮</span>
                        <h2 className="game-reg-title">{scenario.title}</h2>
                    </div>
                    {scenario.description && (
                        <p className="game-reg-desc">{scenario.description}</p>
                    )}
                    <form onSubmit={handleRegister} className="game-reg-form">
                        <div className="game-reg-field">
                            <label>Ім'я</label>
                            <input
                                type="text"
                                value={playerInfo.firstName}
                                onChange={e => setPlayerInfo({ ...playerInfo, firstName: e.target.value })}
                                placeholder="Введіть ім'я"
                                required
                            />
                        </div>
                        <div className="game-reg-field">
                            <label>Прізвище</label>
                            <input
                                type="text"
                                value={playerInfo.lastName}
                                onChange={e => setPlayerInfo({ ...playerInfo, lastName: e.target.value })}
                                placeholder="Введіть прізвище"
                                required
                            />
                        </div>
                        <div className="game-reg-field">
                            <label>Місто</label>
                            <input
                                type="text"
                                value={playerInfo.city}
                                onChange={e => setPlayerInfo({ ...playerInfo, city: e.target.value })}
                                placeholder="Введіть місто"
                                required
                            />
                        </div>
                        <button type="submit" className="btn-restart game-reg-submit">
                            Розпочати гру →
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ── End screen ───────────────────────────────────────────────

    if (endResult) {
        return (
            <div className={`game-end-screen ${endResult.isWin ? 'win' : 'lose'}`} key={`end-${animKey}`}>
                <div className="end-icon">{endResult.isWin ? '🏆' : '💔'}</div>
                <h1>{endResult.isWin ? 'Перемога!' : 'Гра завершена'}</h1>
                {endResult.choiceText && (
                    <p className="end-choice">Ви обрали: <em>«{endResult.choiceText}»</em></p>
                )}
                {endResult.result && (
                    <p className="end-result-text">{endResult.result}</p>
                )}
                <div className="end-actions">
                    {history.length > 0 && (
                        <button className="btn-back" onClick={handleBack}>← Назад</button>
                    )}
                    <button className="btn-restart" onClick={handleRestart}>↺ Почати знову</button>
                </div>
            </div>
        );
    }

    if (!currentNode) return <div className="game-loading">Вузол не знайдено</div>;

    // ── Game screen ──────────────────────────────────────────────

    const speaker = currentNode.speakerId
        ? (scenario.characters || []).find(c => c.charId === currentNode.speakerId)
        : null;

    return (
        <div className="game-container">
            <header className="game-header">
                <span className="game-title">{scenario.title}</span>
                <div className="game-header-right">
                    <span className="game-player-name">
                        {playerInfo.firstName} {playerInfo.lastName}
                    </span>
                    {history.length > 0 && (
                        <button className="btn-back-small" onClick={handleBack}>← Назад</button>
                    )}
                </div>
            </header>

            <div className="game-scene" key={`scene-${animKey}`}>
                {speaker && (
                    <div className="speaker-card" style={{ '--char-color': speaker.color }}>
                        <div className="speaker-avatar">{speaker.avatar}</div>
                        <span className="speaker-name">{speaker.name}</span>
                    </div>
                )}
                <div
                    className={`scene-text ${speaker ? 'has-speaker' : ''}`}
                    style={speaker ? { '--char-color': speaker.color } : {}}
                >
                    {currentNode.text || '(текст сцени відсутній)'}
                </div>
            </div>

            <div className="game-choices" key={`choices-${animKey}`}>
                {currentNode.choices.length === 0 ? (
                    <div className="no-choices-end">
                        <p>Кінець сцени</p>
                        <button className="btn-restart" onClick={handleRestart}>↺ Почати знову</button>
                    </div>
                ) : (
                    currentNode.choices.map((choice, idx) => (
                        <button
                            key={idx}
                            className="choice-btn"
                            onClick={() => handleChoice(choice)}
                        >
                            <span className="choice-letter">{String.fromCharCode(65 + idx)}</span>
                            <span className="choice-text">{choice.text}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

export default GamePlay;
