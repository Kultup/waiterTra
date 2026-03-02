import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
                <div className="detail-field"><span className="field-label">Ім'я</span><span>{item.studentLastName} {item.studentName}</span></div>
                <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
                <div className="detail-field"><span className="field-label">Посада</span><span>{item.studentPosition || '—'}</span></div>
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
            <div className="detail-field"><span className="field-label">Ім'я</span><span>{item.playerLastName} {item.playerName}</span></div>
            <div className="detail-field"><span className="field-label">Місто</span><span>{item.playerCity}</span></div>
            <div className="detail-field"><span className="field-label">Посада</span><span>{item.playerPosition || '—'}</span></div>
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

const QuizAnswersList = ({ answers }) => (
    <div className="detail-errors">
        <div className="detail-steps-label">🔍 Аналіз відповідей</div>
        {answers.map((a, i) => (
            <div key={i} className={`answer-row ${a.isCorrect ? 'correct' : 'wrong'}`}>
                <div className="answer-q">
                    Питання {i + 1}: {a.questionText}
                </div>
                {a.image && (
                    <div className="answer-media" style={{ margin: '0.5rem 0', maxWidth: '200px' }}>
                        <img src={a.image.startsWith('http') ? a.image : `${API_URL.replace('/api', '')}${a.image}`}
                            alt="question" style={{ width: '100%', borderRadius: '4px' }} />
                    </div>
                )}
                {a.video && (
                    <div className="answer-media" style={{ margin: '0.5rem 0', maxWidth: '300px' }}>
                        <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
                            <VideoPlayerMini url={a.video} />
                        </div>
                    </div>
                )}
                <div className="answer-details">
                    <span className={`answer-badge ${a.isCorrect ? 'correct' : 'wrong'}`}>
                        {a.isCorrect ? '✅' : '❌'} {a.givenAnswer}
                    </span>
                    {!a.isCorrect && (
                        <div className="answer-correction">
                            <span className="answer-correct">✓ {a.correctAnswer}</span>
                            {a.explanation && (
                                <div className="answer-explanation">
                                    <strong>Пояснення:</strong> {a.explanation}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        ))}
    </div>
);

const VideoPlayerMini = ({ url }) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1].split('&')[0];
        return <iframe title="YouTube video" width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} frameBorder="0" allowFullScreen></iframe>;
    }
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return <iframe title="Vimeo video" src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} width="100%" height="100%" frameBorder="0" allowFullScreen></iframe>;
    }
    const videoSrc = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
    return <video controls style={{ width: '100%', height: '100%' }}><source src={videoSrc} /></video>;
};

const QuizDetail = ({ item }) => (
    <div className="detail-content">
        <div className="detail-grid">
            <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
            <div className="detail-field"><span className="field-label">Ім'я</span><span>{item.studentLastName} {item.studentName}</span></div>
            <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
            <div className="detail-field"><span className="field-label">Посада</span><span>{item.studentPosition || '—'}</span></div>
            <div className="detail-field"><span className="field-label">Квіз</span><span>{item.quizId?.title || 'Видалений квіз'}</span></div>
        </div>
        <div className="detail-score-block">
            <div className="detail-big-score" style={{ color: item.percentage >= 80 ? '#4ade80' : '#f87171' }}>
                {item.percentage}%
            </div>
            <p>Правильно: <strong>{item.score}</strong> з <strong>{item.total}</strong></p>
        </div>
        {item.answers && item.answers.length > 0 && <QuizAnswersList answers={item.answers} />}
    </div>
);

// ── Complex detail ───────────────────────────────────────────────────────────

const ComplexDetail = ({ item }) => {
    const [expandedStep, setExpandedStep] = React.useState(null);

    return (
        <div className="detail-content">
            <div className="detail-grid">
                <div className="detail-field"><span className="field-label">Дата</span><span>{formatDate(item.completedAt)}</span></div>
                <div className="detail-field"><span className="field-label">Ім'я</span><span>{item.studentLastName} {item.studentName}</span></div>
                <div className="detail-field"><span className="field-label">Місто</span><span>{item.studentCity}</span></div>
                <div className="detail-field"><span className="field-label">Посада</span><span>{item.studentPosition || '—'}</span></div>
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
                    <div className="detail-steps-label">Деталі кроків (натисніть на квіз для аналізу)</div>
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
                                <React.Fragment key={i}>
                                    <tr
                                        onClick={() => s.type === 'quiz' && s.answers ? setExpandedStep(expandedStep === i ? null : i) : null}
                                        style={{ cursor: s.type === 'quiz' && s.answers ? 'pointer' : 'default' }}
                                        className={s.type === 'quiz' && s.answers ? 'clickable-row' : ''}
                                    >
                                        <td>{i + 1}</td>
                                        <td>{s.type === 'desk' ? '🖥️' : s.type === 'game' ? '🎮' : '📝'}</td>
                                        <td>{s.title || '—'} {s.type === 'quiz' && s.answers && (expandedStep === i ? '🔼' : '🔽')}</td>
                                        <td>{s.score}/{s.total} ({s.percentage}%)</td>
                                        <td>
                                            <span className={`status-pill ${s.passed ? 'pass' : 'fail'}`}>
                                                {s.passed ? 'OK' : '✗'}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedStep === i && s.answers && (
                                        <tr>
                                            <td colSpan="5" style={{ padding: '0', background: 'rgba(255,255,255,0.02)' }}>
                                                <div style={{ padding: '1rem' }}>
                                                    <QuizAnswersList answers={s.answers} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

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
                        <th>Ім'я</th>
                        <th>Місто</th>
                        <th>Посада</th>
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
                            <td>{r.studentPosition || '—'}</td>
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
                        <th>Ім'я</th>
                        <th>Місто</th>
                        <th>Посада</th>
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
                            <td>{r.playerPosition || '—'}</td>
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
                        <th>Ім'я</th>
                        <th>Місто</th>
                        <th>Посада</th>
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
                            <td>{r.studentPosition || '—'}</td>
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
                        <th>Ім'я</th>
                        <th>Місто</th>
                        <th>Посада</th>
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
                            <td>{r.studentPosition || '—'}</td>
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

const TestResults = ({ user }) => {
    const [tab, setTab] = useState('desk');
    const [deskResults, setDeskResults] = useState([]);
    const [gameResults, setGameResults] = useState([]);
    const [quizResults, setQuizResults] = useState([]);
    const [complexResults, setComplexResults] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Фільтри для експорту
    const [exportCity, setExportCity] = useState('');
    const [exportDays, setExportDays] = useState(30);
    const [cities, setCities] = useState([]);

    // Detail modal state
    const [detailItem, setDetailItem] = useState(null);
    const [detailType, setDetailType] = useState(null);

    const isAdminCityOnly = user?.role !== 'superadmin' && user?.city;

    const filterByCity = (list) => {
        if (!isAdminCityOnly) return list;
        return list.filter(item => {
            const city = item.studentCity || item.playerCity;
            return city?.toLowerCase() === user.city.toLowerCase();
        });
    };

    // Завантаження списку міст
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/cities`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCities(res.data);
            } catch (err) {
                console.error('Failed to fetch cities:', err);
            }
        };
        fetchCities();
    }, []);

    // Фільтрація для експорту
    const filterForExport = (list) => {
        let filtered = [...list];
        
        // Фільтр по місту (тільки для superadmin)
        if (user?.role === 'superadmin' && exportCity) {
            filtered = filtered.filter(item => {
                const city = item.studentCity || item.playerCity;
                return city === exportCity;
            });
        }
        
        // Фільтр по періоду
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - exportDays);
        filtered = filtered.filter(item => new Date(item.completedAt) >= daysAgo);
        
        return filtered;
    };

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
            setDeskResults(filterByCity(deskRes.data));
            setGameResults(filterByCity(gameRes.data));
            setQuizResults(filterByCity(quizRes.data));
            setComplexResults(filterByCity(complexRes.data));
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

    const exportToExcel = () => {
        // Застосовуємо фільтри
        const filteredDesk = filterForExport(deskResults);
        const filteredGame = filterForExport(gameResults);
        const filteredQuiz = filterForExport(quizResults);
        const filteredComplex = filterForExport(complexResults);
        
        let data = [];
        const dateStr = new Date().toISOString().split('T')[0];
        let filename = `results_${exportCity || 'all'}_${exportDays}days_${dateStr}.xlsx`;

        if (tab === 'desk') {
            data = filteredDesk.map(r => ({
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                'Ім\'я': r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Шаблон': r.templateName,
                'Результат': `${r.score}/${r.total}`,
                'Відсоток': `${r.percentage}%`,
                'Статус': r.passed ? 'Пройдено' : 'Не здано'
            }));
        } else if (tab === 'game') {
            data = filteredGame.map(r => ({
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.playerLastName,
                'Ім\'я': r.playerName,
                'Місто': r.playerCity,
                'Посада': r.playerPosition || '—',
                'Сценарій': r.scenarioTitle,
                'Кінцівка': r.endingTitle || '—',
                'Результат': r.isWin ? 'Перемога' : 'Поразка'
            }));
        } else if (tab === 'quiz') {
            data = filteredQuiz.map(r => ({
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                'Ім\'я': r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Квіз': r.quizId?.title || 'Видалений',
                'Бали': `${r.score}/${r.total}`,
                'Відсоток': `${r.percentage}%`
            }));
        } else if (tab === 'complex') {
            data = filteredComplex.map(r => ({
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                'Ім\'я': r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Тест': r.complexTestId?.title || 'Видалений',
                'Кроків': r.steps?.length || 0,
                'Статус': r.overallPassed ? 'Пройдено' : 'Не здано'
            }));
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="test-results-page">
            <div className="results-page-header">
                <h2>Результати {isAdminCityOnly ? `(${user.city})` : ''}</h2>
                <div className="header-actions">
                    {/* Фільтри для експорту (тільки superadmin) */}
                    {user?.role === 'superadmin' && (
                        <div className="export-filters" style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
                            <select
                                value={exportCity}
                                onChange={(e) => setExportCity(e.target.value)}
                                className="filter-select"
                                title="Фільтр за містом"
                            >
                                <option value="">Всі міста</option>
                                {cities.map(city => (
                                    <option key={city._id} value={city.name}>{city.name}</option>
                                ))}
                            </select>
                            <select
                                value={exportDays}
                                onChange={(e) => setExportDays(Number(e.target.value))}
                                className="filter-select"
                                title="Період"
                            >
                                <option value={7}>7 днів</option>
                                <option value={14}>14 днів</option>
                                <option value={30}>30 днів</option>
                                <option value={90}>90 днів</option>
                                <option value={365}>Рік</option>
                            </select>
                        </div>
                    )}
                    <button className="btn-refresh" onClick={exportToExcel} title="Export to Excel">📊 Excel</button>
                    <button className="btn-refresh" onClick={fetchAll}>🔄 Оновити</button>
                </div>
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
