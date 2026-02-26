import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './TestResults.css';

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

// Групує масив об'єктів за ключем
const groupBy = (arr, key) =>
    arr.reduce((acc, item) => {
        const group = item[key] || 'Без назви';
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {});

// ── Секція одного тесту "Накриття столу" ─────────────────────────────────────

const DeskGroup = ({ name, items }) => {
    const passed = items.filter(r => r.passed).length;
    const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);

    return (
        <div className="result-group">
            <div className="result-group-header">
                <div className="group-title">
                    <span className="group-icon">🍽️</span>
                    <h3>{name}</h3>
                </div>
                <div className="group-meta">
                    <span className="meta-chip">{items.length} спроб</span>
                    <span className="meta-chip passed">{passed} здали</span>
                    <span className="meta-chip neutral">середнє {avg}%</span>
                </div>
            </div>
            <table className="result-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Кандидат</th>
                        <th>Посада</th>
                        <th>Результат</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.studentLastName} {r.studentName}</strong></td>
                            <td>{r.studentPosition}</td>
                            <td>
                                <span className="score-badge">
                                    {r.score}/{r.total}
                                    <small>{r.percentage}%</small>
                                </span>
                            </td>
                            <td>
                                <span className={`status-pill ${r.passed ? 'pass' : 'fail'}`}>
                                    {r.passed ? 'Пройдено' : 'Не здано'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Секція одного ігрового сценарію ──────────────────────────────────────────

const GameGroup = ({ name, items }) => {
    const wins = items.filter(r => r.isWin).length;

    return (
        <div className="result-group">
            <div className="result-group-header">
                <div className="group-title">
                    <span className="group-icon">🎮</span>
                    <h3>{name}</h3>
                </div>
                <div className="group-meta">
                    <span className="meta-chip">{items.length} проходжень</span>
                    <span className="meta-chip passed">{wins} перемог</span>
                    <span className="meta-chip fail">{items.length - wins} поразок</span>
                </div>
            </div>
            <table className="result-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Гравець</th>
                        <th>Посада</th>
                        <th>Кінцівка</th>
                        <th>Результат</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.playerLastName} {r.playerName}</strong></td>
                            <td>{r.playerPosition}</td>
                            <td className="col-ending">{r.endingTitle || '—'}</td>
                            <td>
                                <span className={`status-pill ${r.isWin ? 'pass' : 'fail'}`}>
                                    {r.isWin ? 'Перемога' : 'Поразка'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Головний компонент ────────────────────────────────────────────────────────

const TestResults = () => {
    const [tab, setTab] = useState('desk');
    const [deskResults, setDeskResults] = useState([]);
    const [gameResults, setGameResults] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [deskRes, gameRes] = await Promise.all([
                axios.get(`${API_URL}/test-results`),
                axios.get(`${API_URL}/game-results`),
            ]);
            setDeskResults(deskRes.data);
            setGameResults(gameRes.data);
        } catch (error) {
            console.error('Error fetching results:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const deskGroups = groupBy(deskResults, 'templateName');
    const gameGroups = groupBy(gameResults, 'scenarioTitle');

    return (
        <div className="test-results-page">
            <div className="results-page-header">
                <h2>Результати</h2>
                <button className="btn-refresh" onClick={fetchAll}>🔄 Оновити</button>
            </div>

            <div className="results-tabs">
                <button
                    className={`tab-btn ${tab === 'desk' ? 'active' : ''}`}
                    onClick={() => setTab('desk')}
                >
                    🍽️ Накриття столу
                    {deskResults.length > 0 && (
                        <span className="tab-count">{deskResults.length}</span>
                    )}
                </button>
                <button
                    className={`tab-btn ${tab === 'game' ? 'active' : ''}`}
                    onClick={() => setTab('game')}
                >
                    🎮 Гра (Choice)
                    {gameResults.length > 0 && (
                        <span className="tab-count">{gameResults.length}</span>
                    )}
                </button>
            </div>

            {loading ? (
                <div className="results-loading">Завантаження...</div>
            ) : tab === 'desk' ? (
                <div className="results-groups">
                    {Object.keys(deskGroups).length === 0 ? (
                        <div className="results-empty">Результатів поки немає</div>
                    ) : (
                        Object.entries(deskGroups).map(([name, items]) => (
                            <DeskGroup key={name} name={name} items={items} />
                        ))
                    )}
                </div>
            ) : (
                <div className="results-groups">
                    {Object.keys(gameGroups).length === 0 ? (
                        <div className="results-empty">Результатів поки немає</div>
                    ) : (
                        Object.entries(gameGroups).map(([name, items]) => (
                            <GameGroup key={name} name={name} items={items} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default TestResults;
