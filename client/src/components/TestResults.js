import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './TestResults.css';

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

const groupBy = (arr, key) =>
    arr.reduce((acc, item) => {
        const group = item[key] || 'Без назви';
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {});

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal = ({ show, onClose, children, title }) => {
    if (!show) return null;
    return (
        <div className="detail-overlay" onClick={onClose}>
            <div className="detail-modal" onClick={e => e.stopPropagation()}>
                <div className="detail-header">
                    <h3>{title}</h3>
                    <button className="detail-close" onClick={onClose}>×</button>
                </div>
                <div className="detail-body">{children}</div>
            </div>
        </div>
    );
};

// ── Desk detail ──────────────────────────────────────────────────────────────

const DeskDetail = ({ item }) => {
    const wrongItems = (item.userItems || []).filter(i => !i.isCorrect);
    const missingItems = (item.targetItems || []).filter(target => {
        return !(item.userItems || []).some(ui =>
            ui.type === target.type && ui.isCorrect
        );
    });

    return (
        <div className="detail-content">
            <div className="detail-grid">
                <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
                <div className="detail-field"><span className="field-label">Кандидат</span><span>{item.studentLastName} {item.studentName}</span></div>
                <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
                <div className="detail-field"><span className="field-label">Шаблон</span><span>{item.templateName}</span></div>
            </div>
            <div className="detail-score-block">
                <div className="detail-big-score" style={{ color: item.passed ? '#4ade80' : '#f87171' }}>
                    {item.percentage}%
                </div>
                <p>Правильно: <strong>{item.score}</strong> з <strong>{item.total}</strong></p>
                <span className={`status-pill ${item.passed ? 'pass' : 'fail'}`}>
                    {item.passed ? 'Пройдено' : 'Не здано'}
                </span>
            </div>
            {(wrongItems.length > 0 || missingItems.length > 0) && (
                <div className="detail-errors">
                    <div className="detail-steps-label">🔍 Аналіз помилок</div>
                    {wrongItems.length > 0 && (
                        <div className="error-section">
                            <div className="error-label">❌ Неправильно розміщені ({wrongItems.length})</div>
                            {wrongItems.map((it, i) => (
                                <div key={i} className="error-item wrong">
                                    <span>{it.icon || '🍽️'} {it.name || it.type}</span>
                                    <span className="error-hint">поз. ({Math.round(it.x)}, {Math.round(it.y)})</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {missingItems.length > 0 && (
                        <div className="error-section">
                            <div className="error-label">⚠️ Пропущені предмети ({missingItems.length})</div>
                            {missingItems.map((it, i) => (
                                <div key={i} className="error-item missing">
                                    <span>{it.icon || '🍽️'} {it.name || it.type}</span>
                                    <span className="error-hint">очік. ({Math.round(it.x)}, {Math.round(it.y)})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Game detail ──────────────────────────────────────────────────────────────

const GameDetail = ({ item }) => (
    <div className="detail-content">
        <div className="detail-grid">
            <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
            <div className="detail-field"><span className="field-label">Гравець</span><span>{item.playerLastName} {item.playerName}</span></div>
            <div className="detail-field"><span className="field-label">Місто</span><span>{item.playerCity}</span></div>
            <div className="detail-field"><span className="field-label">Сценарій</span><span>{item.scenarioTitle}</span></div>
            <div className="detail-field"><span className="field-label">Кінцівка</span><span>{item.endingTitle || '—'}</span></div>
        </div>
        <div className="detail-score-block">
            <div className="detail-big-score" style={{ color: item.isWin ? '#4ade80' : '#f87171' }}>
                {item.isWin ? '🎉' : '😔'}
            </div>
            <span className={`status-pill ${item.isWin ? 'pass' : 'fail'}`}>
                {item.isWin ? 'Перемога' : 'Поразка'}
            </span>
        </div>
        {item.choicePath && item.choicePath.length > 0 && (
            <div className="detail-errors">
                <div className="detail-steps-label">🔍 Шлях вибору ({item.choicePath.length} кроків)</div>
                <div className="choice-path">
                    {item.choicePath.map((cp, i) => (
                        <div key={i} className="choice-path-step">
                            <div className="cp-number">{i + 1}</div>
                            <div className="cp-content">
                                {cp.nodeText && <div className="cp-node">{cp.nodeText}</div>}
                                <div className="cp-choice">→ {cp.choiceText}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

// ── Quiz detail ──────────────────────────────────────────────────────────────

const QuizDetail = ({ item }) => (
    <div className="detail-content">
        <div className="detail-grid">
            <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
            <div className="detail-field"><span className="field-label">Студент</span><span>{item.studentLastName} {item.studentName}</span></div>
            <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
            <div className="detail-field"><span className="field-label">Квіз</span><span>{item.quizId?.title || 'Видалений квіз'}</span></div>
        </div>
        <div className="detail-score-block">
            <div className="detail-big-score" style={{ color: item.percentage >= 80 ? '#4ade80' : '#f87171' }}>
                {item.percentage}%
            </div>
            <p>Правильно: <strong>{item.score}</strong> з <strong>{item.total}</strong></p>
        </div>
        {item.answers && item.answers.length > 0 && (
            <div className="detail-errors">
                <div className="detail-steps-label">🔍 Аналіз відповідей</div>
                {item.answers.map((a, i) => (
                    <div key={i} className={`answer-row ${a.isCorrect ? 'correct' : 'wrong'}`}>
                        <div className="answer-q">Питання {i + 1}: {a.questionText}</div>
                        <div className="answer-details">
                            <span className={`answer-badge ${a.isCorrect ? 'correct' : 'wrong'}`}>
                                {a.isCorrect ? '✅' : '❌'} {a.givenAnswer}
                            </span>
                            {!a.isCorrect && (
                                <span className="answer-correct">✓ {a.correctAnswer}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// ── Complex detail ───────────────────────────────────────────────────────────

const ComplexDetail = ({ item }) => (
    <div className="detail-content">
        <div className="detail-grid">
            <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
            <div className="detail-field"><span className="field-label">Студент</span><span>{item.studentLastName} {item.studentName}</span></div>
            <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
            <div className="detail-field"><span className="field-label">Тест</span><span>{item.complexTestId?.title || 'Видалений тест'}</span></div>
        </div>
        <div className="detail-score-block">
            <div className="detail-big-score" style={{ color: item.overallPassed ? '#4ade80' : '#f87171' }}>
                {item.overallPassed ? '✅' : '❌'}
            </div>
            <span className={`status-pill ${item.overallPassed ? 'pass' : 'fail'}`}>
                {item.overallPassed ? 'Всі кроки пройдено' : 'Є провалені кроки'}
            </span>
        </div>
        {item.steps && item.steps.length > 0 && (
            <div className="detail-steps">
                <div className="detail-steps-label">Деталі кроків</div>
                <table className="result-table detail-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Тип</th>
                            <th>Назва</th>
                            <th>Бали</th>
                            <th>Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        {item.steps.map((s, i) => (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{s.type === 'desk' ? '🖥️' : s.type === 'game' ? '🎮' : '📝'}</td>
                                <td>{s.title || '—'}</td>
                                <td>{s.score}/{s.total} ({s.percentage}%)</td>
                                <td>
                                    <span className={`status-pill ${s.passed ? 'pass' : 'fail'}`}>
                                        {s.passed ? 'OK' : '✗'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// ── Group components (with clickable rows) ────────────────────────────────────

const DeskGroup = ({ name, items, onRowClick }) => {
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
                        <th>Місто</th>
                        <th>Результат</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id} className="clickable-row" onClick={() => onRowClick(r)}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.studentLastName} {r.studentName}</strong></td>
                            <td>{r.studentCity}</td>
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

const GameGroup = ({ name, items, onRowClick }) => {
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
                        <th>Місто</th>
                        <th>Кінцівка</th>
                        <th>Результат</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id} className="clickable-row" onClick={() => onRowClick(r)}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.playerLastName} {r.playerName}</strong></td>
                            <td>{r.playerCity}</td>
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

const QuizGroup = ({ name, items, onRowClick }) => {
    const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);

    return (
        <div className="result-group">
            <div className="result-group-header">
                <div className="group-title">
                    <span className="group-icon">📝</span>
                    <h3>{name}</h3>
                </div>
                <div className="group-meta">
                    <span className="meta-chip">{items.length} спроб</span>
                    <span className="meta-chip neutral">середнє {avg}%</span>
                </div>
            </div>
            <table className="result-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Студент</th>
                        <th>Місто</th>
                        <th>Бали</th>
                        <th>Результат</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id} className="clickable-row" onClick={() => onRowClick(r)}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.studentLastName} {r.studentName}</strong></td>
                            <td>{r.studentCity}</td>
                            <td>{r.score} / {r.total}</td>
                            <td>
                                <span className="score-badge">{r.percentage}%</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ComplexGroup = ({ name, items, onRowClick }) => {
    const passed = items.filter(r => r.overallPassed).length;

    return (
        <div className="result-group">
            <div className="result-group-header">
                <div className="group-title">
                    <span className="group-icon">🧩</span>
                    <h3>{name}</h3>
                </div>
                <div className="group-meta">
                    <span className="meta-chip">{items.length} проходжень</span>
                    <span className="meta-chip passed">{passed} пройшли</span>
                    <span className="meta-chip fail">{items.length - passed} провалено</span>
                </div>
            </div>
            <table className="result-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Студент</th>
                        <th>Місто</th>
                        <th>Кроків</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(r => (
                        <tr key={r._id} className="clickable-row" onClick={() => onRowClick(r)}>
                            <td className="col-date">{formatDate(r.completedAt)}</td>
                            <td><strong>{r.studentLastName} {r.studentName}</strong></td>
                            <td>{r.studentCity}</td>
                            <td>{r.steps?.length || 0}</td>
                            <td>
                                <span className={`status-pill ${r.overallPassed ? 'pass' : 'fail'}`}>
                                    {r.overallPassed ? 'Пройдено' : 'Не здано'}
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
    const [quizResults, setQuizResults] = useState([]);
    const [complexResults, setComplexResults] = useState([]);
    const [loading, setLoading] = useState(true);

    // Detail modal state
    const [detailItem, setDetailItem] = useState(null);
    const [detailType, setDetailType] = useState(null);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const [deskRes, gameRes, quizRes, complexRes] = await Promise.all([
                axios.get(`${API_URL}/test-results`, config),
                axios.get(`${API_URL}/game-results`, config),
                axios.get(`${API_URL}/quiz/results`, config),
                axios.get(`${API_URL}/complex-tests/results`, config),
            ]);
            setDeskResults(deskRes.data);
            setGameResults(gameRes.data);
            setQuizResults(quizRes.data);
            setComplexResults(complexRes.data);
        } catch (error) {
            console.error('Error fetching results:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const openDetail = (type, item) => {
        setDetailType(type);
        setDetailItem(item);
    };

    const closeDetail = () => {
        setDetailItem(null);
        setDetailType(null);
    };

    const deskGroups = groupBy(deskResults, 'templateName');
    const gameGroups = groupBy(gameResults, 'scenarioTitle');
    const quizGroups = quizResults.reduce((acc, r) => {
        const name = r.quizId?.title || 'Видалений квіз';
        if (!acc[name]) acc[name] = [];
        acc[name].push(r);
        return acc;
    }, {});
    const complexGroups = complexResults.reduce((acc, r) => {
        const name = r.complexTestId?.title || 'Видалений тест';
        if (!acc[name]) acc[name] = [];
        acc[name].push(r);
        return acc;
    }, {});

    return (
        <div className="test-results-page">
            <div className="results-page-header">
                <h2>Результати</h2>
                <button className="btn-refresh" onClick={fetchAll}>🔄 Оновити</button>
            </div>

            <div className="results-tabs">
                <button className={`tab-btn ${tab === 'desk' ? 'active' : ''}`} onClick={() => setTab('desk')}>
                    🍽️ Накриття столу
                    {deskResults.length > 0 && <span className="tab-count">{deskResults.length}</span>}
                </button>
                <button className={`tab-btn ${tab === 'game' ? 'active' : ''}`} onClick={() => setTab('game')}>
                    🎮 Гра (Choice)
                    {gameResults.length > 0 && <span className="tab-count">{gameResults.length}</span>}
                </button>
                <button className={`tab-btn ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}>
                    📝 Квізи
                    {quizResults.length > 0 && <span className="tab-count">{quizResults.length}</span>}
                </button>
                <button className={`tab-btn ${tab === 'complex' ? 'active' : ''}`} onClick={() => setTab('complex')}>
                    🧩 Комплексний
                    {complexResults.length > 0 && <span className="tab-count">{complexResults.length}</span>}
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
                            <DeskGroup key={name} name={name} items={items} onRowClick={r => openDetail('desk', r)} />
                        ))
                    )}
                </div>
            ) : tab === 'game' ? (
                <div className="results-groups">
                    {Object.keys(gameGroups).length === 0 ? (
                        <div className="results-empty">Результатів поки немає</div>
                    ) : (
                        Object.entries(gameGroups).map(([name, items]) => (
                            <GameGroup key={name} name={name} items={items} onRowClick={r => openDetail('game', r)} />
                        ))
                    )}
                </div>
            ) : tab === 'quiz' ? (
                <div className="results-groups">
                    {Object.keys(quizGroups).length === 0 ? (
                        <div className="results-empty">Результатів поки немає</div>
                    ) : (
                        Object.entries(quizGroups).map(([name, items]) => (
                            <QuizGroup key={name} name={name} items={items} onRowClick={r => openDetail('quiz', r)} />
                        ))
                    )}
                </div>
            ) : (
                <div className="results-groups">
                    {Object.keys(complexGroups).length === 0 ? (
                        <div className="results-empty">Результатів поки немає</div>
                    ) : (
                        Object.entries(complexGroups).map(([name, items]) => (
                            <ComplexGroup key={name} name={name} items={items} onRowClick={r => openDetail('complex', r)} />
                        ))
                    )}
                </div>
            )}

            {/* Detail Modal */}
            <DetailModal
                show={!!detailItem}
                onClose={closeDetail}
                title={
                    detailType === 'desk' ? '🍽️ Деталі сервірування' :
                        detailType === 'game' ? '🎮 Деталі гри' :
                            detailType === 'quiz' ? '📝 Деталі квізу' :
                                '🧩 Деталі комплексного тесту'
                }
            >
                {detailType === 'desk' && detailItem && <DeskDetail item={detailItem} />}
                {detailType === 'game' && detailItem && <GameDetail item={detailItem} />}
                {detailType === 'quiz' && detailItem && <QuizDetail item={detailItem} />}
                {detailType === 'complex' && detailItem && <ComplexDetail item={detailItem} />}
            </DetailModal>
        </div>
    );
};

export default TestResults;
