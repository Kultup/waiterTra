import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as XLSX from 'xlsx';
import API_URL, { getUserPlatform } from '../api';
import './TestResults.css';

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

const initials = (...parts) =>
    parts.filter(Boolean).map(s => s[0]?.toUpperCase()).join('');

// ── Editable city field ───────────────────────────────────────────────────────

const EditableCity = ({ value, cities, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [selected, setSelected] = useState(value || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!selected.trim() || selected === value) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(selected.trim());
            setEditing(false);
        } catch { /* error handled in parent */ }
        setSaving(false);
    };

    if (!editing) {
        return (
            <span className="tr-editable-city" onClick={() => setEditing(true)} title="Натисніть щоб змінити місто">
                {value || '—'} <span className="tr-edit-icon">✏️</span>
            </span>
        );
    }

    return (
        <span className="tr-city-editor">
            <select value={selected} onChange={e => setSelected(e.target.value)} className="tr-city-select" autoFocus>
                <option value="">Оберіть місто</option>
                {cities.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
            <button className="tr-city-save" onClick={handleSave} disabled={saving}>{saving ? '...' : '✓'}</button>
            <button className="tr-city-cancel" onClick={() => { setSelected(value || ''); setEditing(false); }}>✕</button>
        </span>
    );
};

// ── Avatar ────────────────────────────────────────────────────────────────────

const Avatar = ({ text, passed }) => (
    <div className={`tr-avatar ${passed ? 'pass' : 'fail'}`}>
        {text || '?'}
    </div>
);

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal = ({ show, onClose, children, title }) => {
    useEffect(() => {
        if (!show) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [show, onClose]);

    if (!show) return null;
    return (
        <div className="tr-overlay" onClick={onClose}>
            <div className="tr-modal" onClick={e => e.stopPropagation()}>
                <div className="tr-modal-header">
                    <span className="tr-modal-title">{title}</span>
                    <button className="tr-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="tr-modal-body">{children}</div>
            </div>
        </div>
    );
};

// ── Desk detail ──────────────────────────────────────────────────────────────

const DeskDetail = ({ item, cities, canEdit, onCityChange }) => {
    const nameMap = {};
    (item.targetItems || []).forEach(t => { if (t.type && t.name) nameMap[t.type] = t.name; });
    const getName = (i) => i.name || nameMap[i.type] || i.icon || i.type;

    const wrongItems = (item.userItems || []).filter(i => !i.isCorrect);
    const missingItems = (item.targetItems || []).filter(target =>
        !(item.userItems || []).some(ui => ui.type === target.type && ui.isCorrect)
    );
    return (
        <div className="tr-detail">
            <div className="tr-detail-meta">
                <MetaField label="Дата" value={formatDate(item.completedAt)} />
                <MetaField label="Ім'я" value={`${item.studentLastName} ${item.studentName}`} />
                <MetaField label="Місто" value={canEdit
                    ? <EditableCity value={item.studentCity} cities={cities} onSave={onCityChange} />
                    : item.studentCity} />
                <MetaField label="Посада" value={item.studentPosition || '—'} />
                <MetaField label="Шаблон" value={item.templateName} span={2} />
            </div>
            <ScoreBlock
                score={`${item.percentage}%`}
                sub={`${item.score} з ${item.total} правильно`}
                passed={item.passed}
                label={item.passed ? 'Пройдено' : 'Не здано'}
            />
            {(wrongItems.length > 0 || missingItems.length > 0) && (
                <ErrorSection>
                    {wrongItems.length > 0 && (
                        <ErrorGroup label={`❌ Неправильно розміщені (${wrongItems.length})`}>
                            {wrongItems.map((it, i) => (
                                <ErrorItem key={i} icon={it.icon} name={getName(it)}
                                    hint={`(${Math.round(it.x)}, ${Math.round(it.y)})`} type="wrong" />
                            ))}
                        </ErrorGroup>
                    )}
                    {missingItems.length > 0 && (
                        <ErrorGroup label={`⚠️ Пропущені предмети (${missingItems.length})`}>
                            {missingItems.map((it, i) => (
                                <ErrorItem key={i} icon={it.icon} name={getName(it)}
                                    hint={`(${Math.round(it.x)}, ${Math.round(it.y)})`} type="missing" />
                            ))}
                        </ErrorGroup>
                    )}
                </ErrorSection>
            )}
        </div>
    );
};

// ── Game detail ──────────────────────────────────────────────────────────────

const GameDetail = ({ item, cities, canEdit, onCityChange }) => (
    <div className="tr-detail">
        <div className="tr-detail-meta">
            <MetaField label="Дата" value={formatDate(item.completedAt)} />
            <MetaField label="Ім'я" value={`${item.playerLastName || item.studentLastName} ${item.playerName || item.studentName}`} />
            <MetaField label="Місто" value={canEdit
                ? <EditableCity value={item.playerCity || item.city} cities={cities} onSave={onCityChange} />
                : (item.playerCity || item.city)} />
            <MetaField label="Посада" value={item.playerPosition || item.position || '—'} />
            <MetaField label="Сценарій" value={item.scenarioTitle} />
            <MetaField label="Кінцівка" value={item.endingTitle || '—'} />
        </div>
        <ScoreBlock
            score={item.isWin ? '🎉' : '😔'}
            passed={item.isWin}
            label={item.isWin ? 'Перемога' : 'Поразка'}
        />
        {item.choicePath?.length > 0 && (
            <ErrorSection label={`🔍 Шлях вибору (${item.choicePath.length} кроків)`}>
                <div className="tr-path">
                    {item.choicePath.map((cp, i) => (
                        <div key={i} className="tr-path-step">
                            <div className="tr-path-num">{i + 1}</div>
                            <div className="tr-path-body">
                                {cp.nodeText && <div className="tr-path-node">{cp.nodeText}</div>}
                                <div className="tr-path-choice">→ {cp.choiceText}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </ErrorSection>
        )}
    </div>
);

// ── Quiz detail ──────────────────────────────────────────────────────────────

const VideoPlayerMini = ({ url }) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&]+)/);
    if (ytMatch) return <iframe title="yt" width="100%" height="100%"
        src={`https://www.youtube.com/embed/${ytMatch[1]}`} frameBorder="0" allowFullScreen />;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return <iframe title="vimeo"
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} width="100%" height="100%" frameBorder="0" allowFullScreen />;
    const src = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
    return <video controls style={{ width: '100%', height: '100%' }}><source src={src} /></video>;
};

const QuizAnswersList = ({ answers }) => (
    <ErrorSection label="🔍 Аналіз відповідей">
        {answers.map((a, i) => (
            <div key={i} className={`tr-answer ${a.isCorrect ? 'correct' : 'wrong'}`}>
                <div className="tr-answer-q">Питання {i + 1}: {a.questionText}</div>
                {a.image && (
                    <img src={a.image.startsWith('http') ? a.image : `${API_URL.replace('/api', '')}${a.image}`}
                        alt="" className="tr-answer-img" />
                )}
                {a.video && (
                    <div className="tr-answer-video">
                        <VideoPlayerMini url={a.video} />
                    </div>
                )}
                <div className="tr-answer-row">
                    <span className={`tr-answer-badge ${a.isCorrect ? 'correct' : 'wrong'}`}>
                        {a.isCorrect ? '✅' : '❌'} {a.givenAnswer}
                    </span>
                    {!a.isCorrect && (
                        <div className="tr-answer-correction">
                            <span className="tr-answer-correct">✓ {a.correctAnswer}</span>
                            {a.explanation && (
                                <div className="tr-answer-explain">{a.explanation}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        ))}
    </ErrorSection>
);

const QuizDetail = ({ item, cities, canEdit, onCityChange }) => (
    <div className="tr-detail">
        <div className="tr-detail-meta">
            <MetaField label="Дата" value={formatDate(item.completedAt)} />
            <MetaField label="Ім'я" value={`${item.studentLastName} ${item.studentName}`} />
            <MetaField label="Місто" value={canEdit
                ? <EditableCity value={item.studentCity} cities={cities} onSave={onCityChange} />
                : item.studentCity} />
            <MetaField label="Посада" value={item.studentPosition || '—'} />
            <MetaField label="Квіз" value={item.quizId?.title || 'Видалений квіз'} span={2} />
        </div>
        <ScoreBlock
            score={`${item.percentage}%`}
            sub={`${item.score} з ${item.total} правильно`}
            passed={item.percentage >= 80}
            label={item.percentage >= 80 ? 'Пройдено' : 'Не здано'}
        />
        {item.answers?.length > 0 && <QuizAnswersList answers={item.answers} />}
    </div>
);

// ── Complex detail ────────────────────────────────────────────────────────────

const ComplexDetail = ({ item, cities, canEdit, onCityChange }) => {
    const [expanded, setExpanded] = useState(null);
    return (
        <div className="tr-detail">
            <div className="tr-detail-meta">
                <MetaField label="Дата" value={formatDate(item.completedAt)} />
                <MetaField label="Ім'я" value={`${item.studentLastName} ${item.studentName}`} />
                <MetaField label="Місто" value={canEdit
                    ? <EditableCity value={item.studentCity} cities={cities} onSave={onCityChange} />
                    : item.studentCity} />
                <MetaField label="Посада" value={item.studentPosition || '—'} />
                <MetaField label="Тест" value={item.complexTestId?.title || 'Видалений тест'} span={2} />
            </div>
            <ScoreBlock
                score={item.overallPassed ? '✅' : '❌'}
                passed={item.overallPassed}
                label={item.overallPassed ? 'Всі кроки пройдено' : 'Є провалені кроки'}
            />
            {item.steps?.length > 0 && (
                <ErrorSection label="Деталі кроків">
                    {item.steps.map((s, i) => (
                        <React.Fragment key={i}>
                            <div
                                className={`tr-step ${s.passed ? 'pass' : 'fail'} ${s.type === 'quiz' && s.answers ? 'clickable' : ''}`}
                                onClick={() => s.type === 'quiz' && s.answers && setExpanded(expanded === i ? null : i)}
                            >
                                <div className="tr-step-icon">
                                    {s.type === 'desk' ? '🖥️' : s.type === 'game' ? '🎮' : '📝'}
                                </div>
                                <div className="tr-step-name">{s.title || '—'}</div>
                                <div className="tr-step-score">{s.score}/{s.total} · {s.percentage}%</div>
                                <span className={`tr-pill ${s.passed ? 'pass' : 'fail'}`}>
                                    {s.passed ? 'OK' : '✗'}
                                </span>
                                {s.type === 'quiz' && s.answers && (
                                    <span className="tr-step-toggle">{expanded === i ? '▲' : '▼'}</span>
                                )}
                            </div>
                            {expanded === i && s.answers && (
                                <div className="tr-step-answers">
                                    <QuizAnswersList answers={s.answers} />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </ErrorSection>
            )}
        </div>
    );
};

// ── Shared detail sub-components ──────────────────────────────────────────────

const MetaField = ({ label, value, span }) => (
    <div className="tr-meta-field" style={span ? { gridColumn: `span ${span}` } : {}}>
        <span className="tr-meta-label">{label}</span>
        <span className="tr-meta-value">{value}</span>
    </div>
);

const ScoreBlock = ({ score, sub, passed, label }) => (
    <div className={`tr-score-block ${passed ? 'pass' : 'fail'}`}>
        <div className="tr-score-big">{score}</div>
        {sub && <div className="tr-score-sub">{sub}</div>}
        <span className={`tr-pill ${passed ? 'pass' : 'fail'}`}>{label}</span>
    </div>
);

const ErrorSection = ({ label, children }) => (
    <div className="tr-section">
        {label && <div className="tr-section-label">{label}</div>}
        {children}
    </div>
);

const ErrorGroup = ({ label, children }) => (
    <div className="tr-error-group">
        <div className="tr-error-group-label">{label}</div>
        {children}
    </div>
);

const ErrorItem = ({ icon, name, hint, type }) => (
    <div className={`tr-error-item ${type}`}>
        <span>{icon || '🍽️'} {name}</span>
        <span className="tr-error-hint">{hint}</span>
    </div>
);

// ── Result Card Row ───────────────────────────────────────────────────────────

const ResultCard = ({ onClick, passed, avatarText, name, sub, city, date, extra, score }) => (
    <div className={`tr-card ${passed ? 'pass' : 'fail'}`} onClick={onClick}>
        <Avatar text={avatarText} passed={passed} />
        <div className="tr-card-main">
            <div className="tr-card-name">{name}</div>
            <div className="tr-card-sub">{sub}</div>
        </div>
        <div className="tr-card-city">
            <span>{city}</span>
            <span className="tr-card-date">{date}</span>
        </div>
        {extra && <div className="tr-card-extra">{extra}</div>}
        <div className="tr-card-score">{score}</div>
        <div className="tr-card-chevron">›</div>
    </div>
);

// ── Group ─────────────────────────────────────────────────────────────────────

const Group = ({ icon, name, chips, children, isOpen, onToggle }) => (
    <div className="tr-group">
        <div className="tr-group-header" onClick={onToggle} role="button" tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>
            <div className="tr-group-left">
                <span className="tr-group-icon">{icon}</span>
                <span className="tr-group-name">{name}</span>
            </div>
            <div className="tr-group-right">
                <div className="tr-group-chips">{chips}</div>
                <span className={`tr-group-chevron ${isOpen ? 'open' : ''}`}>›</span>
            </div>
        </div>
        {isOpen && <div className="tr-group-body">{children}</div>}
    </div>
);

// ── Stats strip ───────────────────────────────────────────────────────────────

const StatsStrip = ({ items, tab }) => {
    const stats = useMemo(() => {
        if (!items.length) return null;
        if (tab === 'game') {
            const wins = items.filter(r => r.isWin).length;
            return [
                { label: 'Всього', value: items.length },
                { label: 'Перемог', value: wins, color: 'green' },
                { label: 'Поразок', value: items.length - wins, color: 'red' },
                { label: 'Рейтинг', value: `${Math.round(wins / items.length * 100)}%`, color: wins / items.length >= 0.8 ? 'green' : 'red' },
            ];
        }
        const passedKey = tab === 'complex' ? 'overallPassed' : 'passed';
        const passed = items.filter(r => r[passedKey]).length;
        const rate = Math.round(passed / items.length * 100);
        const avg = tab !== 'complex'
            ? Math.round(items.reduce((s, r) => s + (r.percentage || 0), 0) / items.length)
            : null;
        return [
            { label: 'Всього', value: items.length },
            { label: 'Здали', value: passed, color: 'green' },
            { label: 'Не здали', value: items.length - passed, color: 'red' },
            { label: 'Успішність', value: `${rate}%`, color: rate >= 80 ? 'green' : 'red' },
            ...(avg !== null ? [{ label: 'Середній %', value: `${avg}%`, color: avg >= 80 ? 'green' : 'neutral' }] : []),
        ];
    }, [items, tab]);

    if (!stats) return null;
    return (
        <div className="tr-stats">
            {stats.map((s, i) => (
                <div key={i} className={`tr-stat ${s.color || ''}`}>
                    <div className="tr-stat-value">{s.value}</div>
                    <div className="tr-stat-label">{s.label}</div>
                </div>
            ))}
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
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState({});
    const [sortOrder, setSortOrder] = useState('newest');

    const [filterCity, setFilterCity] = useState('');
    const [filterDays, setFilterDays] = useState(0);
    const [cities, setCities] = useState([]);

    const [detailItem, setDetailItem] = useState(null);
    const [detailType, setDetailType] = useState(null);

    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiModalOpen, setAiModalOpen] = useState(false);

    const isAdminCityOnly = user?.role !== 'superadmin' && user?.city;

    const filterByCity = (list) => {
        if (!isAdminCityOnly) return list;
        return list.filter(item => {
            const city = item.studentCity || item.playerCity;
            return city?.toLowerCase() === user.city.toLowerCase();
        });
    };

    useEffect(() => {
        axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(res => setCities(res.data)).catch(() => {});
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
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
        } catch (err) {
            console.error('Error fetching results:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // WebSocket real-time updates
    useEffect(() => {
        const token = localStorage.getItem('token');
        const socket = io(API_URL.replace('/api', ''), {
            transports: ['websocket'],
            forceNew: true,
            auth: { token }
        });

        socket.on('NEW_RESULT', (newResult) => {
            console.log('Real-time result received:', newResult);
            
            // Determine result type and update state if it matches user's city
            const city = newResult.studentCity || newResult.playerCity || newResult.city;
            if (isAdminCityOnly && city?.toLowerCase() !== user.city.toLowerCase()) return;

            // Map the result to the correct state
            if (newResult.templateName && !newResult.complexTestId) {
                setDeskResults(prev => [newResult, ...prev]);
            } else if (newResult.scenarioTitle) {
                setGameResults(prev => [newResult, ...prev]);
            } else if (newResult.quizId) {
                setQuizResults(prev => [newResult, ...prev]);
            } else if (newResult.complexTestId) {
                setComplexResults(prev => [newResult, ...prev]);
            }
        });

        return () => socket.disconnect();
    }, [user, isAdminCityOnly]);

    const openDetail = (type, item) => { setDetailType(type); setDetailItem(item); };
    const closeDetail = () => { setDetailItem(null); setDetailType(null); };

    const canEditCity = ['superadmin', 'admin', 'trainer'].includes(user?.role);

    const updateCity = async (type, id, newCity) => {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const endpoints = {
            desk: `${API_URL}/test-results/${id}/city`,
            game: `${API_URL}/game-results/${id}/city`,
            quiz: `${API_URL}/quiz/results/${id}/city`,
            complex: `${API_URL}/complex-tests/results/${id}/city`,
        };
        await axios.patch(endpoints[type], { city: newCity }, config);
        // Update local state
        const cityField = type === 'game' ? 'city' : 'studentCity';
        const updateItem = (list) => list.map(r =>
            r._id === id ? { ...r, [cityField]: newCity, ...(type !== 'game' ? { city: newCity } : {}) } : r
        );
        if (type === 'desk') setDeskResults(prev => updateItem(prev));
        if (type === 'game') setGameResults(prev => updateItem(prev));
        if (type === 'quiz') setQuizResults(prev => updateItem(prev));
        if (type === 'complex') setComplexResults(prev => updateItem(prev));
        // Update detail modal item
        if (detailItem?._id === id) {
            setDetailItem(prev => ({ ...prev, [cityField]: newCity, ...(type !== 'game' ? { city: newCity } : {}) }));
        }
    };

    const toggleGroup = (name) =>
        setCollapsed(prev => ({ ...prev, [name]: !prev[name] }));

    const isOpen = (name) => collapsed[name] !== true;

    // ── Universal filter (city + period + search) ──
    const applyFilters = (list) => {
        let f = list;
        if (filterCity) {
            f = f.filter(r => (r.studentCity || r.playerCity) === filterCity);
        }
        if (filterDays > 0) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - filterDays);
            f = f.filter(r => new Date(r.completedAt) >= cutoff);
        }
        if (search) {
            const q = search.toLowerCase();
            f = f.filter(r => {
                const name = `${r.studentLastName || r.playerLastName || ''} ${r.studentName || r.playerName || ''}`.toLowerCase();
                const city = (r.studentCity || r.playerCity || '').toLowerCase();
                return name.includes(q) || city.includes(q);
            });
        }
        return f;
    };

    const sortList = (arr) => [...arr].sort((a, b) => {
        const da = new Date(a.completedAt), db = new Date(b.completedAt);
        return sortOrder === 'newest' ? db - da : da - db;
    });

    // Filtered + sorted data for each type
    const filteredDesk = sortList(applyFilters(deskResults));
    const filteredGame = sortList(applyFilters(gameResults));
    const filteredQuiz = sortList(applyFilters(quizResults));
    const filteredComplex = sortList(applyFilters(complexResults));

    const currentFiltered = tab === 'desk' ? filteredDesk
        : tab === 'game' ? filteredGame
        : tab === 'quiz' ? filteredQuiz
        : filteredComplex;

    // Group by
    const makeGroups = (arr, keyFn) =>
        arr.reduce((acc, item) => {
            const k = keyFn(item);
            if (!acc[k]) acc[k] = [];
            acc[k].push(item);
            return acc;
        }, {});

    const deskGroups = makeGroups(filteredDesk, r => r.templateName || 'Без назви');
    const gameGroups = makeGroups(filteredGame, r => r.scenarioTitle || 'Без назви');
    const quizGroups = makeGroups(filteredQuiz, r => r.quizId?.title || 'Видалений квіз');
    const complexGroups = makeGroups(filteredComplex, r => r.complexTestId?.title || 'Видалений тест');

    const currentGroups = tab === 'desk' ? deskGroups
        : tab === 'game' ? gameGroups
        : tab === 'quiz' ? quizGroups
        : complexGroups;

    const handleAiAnalyze = async () => {
        setAiLoading(true);
        setAiModalOpen(true);
        setAiAnalysis('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/ai/analyze`, {
                mode: 'results',
                city: filterCity || undefined,
                days: filterDays || undefined,
                tab,
            }, { headers: { Authorization: `Bearer ${token}` } });
            setAiAnalysis(res.data.analysis);
        } catch (err) {
            setAiAnalysis('Помилка аналізу: ' + (err.response?.data?.error || err.message));
        } finally {
            setAiLoading(false);
        }
    };

    const autoWidth = (ws, data) => {
        if (!data.length) return;
        const keys = Object.keys(data[0]);
        ws['!cols'] = keys.map(k => {
            const maxLen = Math.max(k.length, ...data.map(r => String(r[k] || '').length));
            return { wch: Math.min(maxLen + 2, 60) };
        });
    };

    const exportToExcel = () => {
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `results_${filterCity || 'all'}_${filterDays || 'all'}d_${dateStr}.xlsx`;
        const wb = XLSX.utils.book_new();

        // ── Desk ──
        const deskData = filteredDesk.map(r => {
            // Build a lookup from type → name using targetItems (always has names)
            const nameMap = {};
            (r.targetItems || []).forEach(t => { if (t.type && t.name) nameMap[t.type] = t.name; });
            const getName = (item) => item.name || nameMap[item.type] || item.icon || item.type;

            const wrongItems = (r.userItems || []).filter(i => !i.isCorrect);
            const missingItems = (r.targetItems || []).filter(target =>
                !(r.userItems || []).some(ui => ui.type === target.type && ui.isCorrect)
            );
            return {
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                "Ім'я": r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Шаблон': r.templateName,
                'Результат': `${r.score}/${r.total}`,
                'Відсоток': r.percentage,
                'Статус': r.passed ? 'Пройдено' : 'Не здано',
                'Неправильно розміщені': wrongItems.map(getName).join(', ') || '—',
                'Пропущені предмети': missingItems.map(getName).join(', ') || '—',
            };
        });
        if (deskData.length) {
            const ws = XLSX.utils.json_to_sheet(deskData);
            autoWidth(ws, deskData);
            XLSX.utils.book_append_sheet(wb, ws, 'Сервірування');
        }

        // ── Game ──
        const gameData = filteredGame.map(r => ({
            'Дата': formatDate(r.completedAt),
            'Прізвище': r.playerLastName,
            "Ім'я": r.playerName,
            'Місто': r.playerCity,
            'Посада': r.playerPosition || '—',
            'Сценарій': r.scenarioTitle,
            'Кінцівка': r.endingTitle || '—',
            'Статус': r.isWin ? 'Перемога' : 'Поразка',
            'Шлях вибору': (r.choicePath || []).map(cp => cp.choiceText).join(' → ') || '—',
        }));
        if (gameData.length) {
            const ws = XLSX.utils.json_to_sheet(gameData);
            autoWidth(ws, gameData);
            XLSX.utils.book_append_sheet(wb, ws, 'Гра');
        }

        // ── Quiz ──
        const quizData = filteredQuiz.map(r => {
            const row = {
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                "Ім'я": r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Квіз': r.quizId?.title || 'Видалений',
                'Результат': `${r.score}/${r.total}`,
                'Відсоток': r.percentage,
                'Статус': r.passed ? 'Пройдено' : 'Не здано',
                'Помилок': (r.answers || []).filter(a => !a.isCorrect).length,
            };
            // Add each question as a column
            (r.answers || []).forEach((a, i) => {
                row[`П${i + 1}`] = a.isCorrect ? '✓' : `✗ (${a.givenAnswer})`;
            });
            return row;
        });
        if (quizData.length) {
            const ws = XLSX.utils.json_to_sheet(quizData);
            autoWidth(ws, quizData);
            XLSX.utils.book_append_sheet(wb, ws, 'Квіз');
        }

        // ── Complex ──
        const complexData = filteredComplex.map(r => {
            const row = {
                'Дата': formatDate(r.completedAt),
                'Прізвище': r.studentLastName,
                "Ім'я": r.studentName,
                'Місто': r.studentCity,
                'Посада': r.studentPosition || '—',
                'Тест': r.complexTestId?.title || 'Видалений',
                'Кроків': r.steps?.length || 0,
                'Статус': r.overallPassed ? 'Пройдено' : 'Не здано',
            };
            (r.steps || []).forEach((s, i) => {
                row[`Крок ${i + 1}: ${s.title || s.type}`] = `${s.score}/${s.total} (${s.percentage}%) ${s.passed ? '✓' : '✗'}`;
            });
            return row;
        });
        if (complexData.length) {
            const ws = XLSX.utils.json_to_sheet(complexData);
            autoWidth(ws, complexData);
            XLSX.utils.book_append_sheet(wb, ws, 'Комплексний');
        }

        // ── Summary sheet ──
        const summaryData = [];
        const addSummary = (label, items, passedFn, pctFn) => {
            if (!items.length) return;
            const passed = items.filter(passedFn).length;
            const avg = pctFn ? Math.round(items.reduce((s, r) => s + pctFn(r), 0) / items.length) : null;
            summaryData.push({
                'Тип': label,
                'Всього': items.length,
                'Здали': passed,
                'Не здали': items.length - passed,
                'Успішність %': Math.round(passed / items.length * 100),
                'Середній %': avg ?? '—',
            });
        };
        addSummary('Сервірування', filteredDesk, r => r.passed, r => r.percentage);
        addSummary('Гра', filteredGame, r => r.isWin, null);
        addSummary('Квіз', filteredQuiz, r => r.passed, r => r.percentage);
        addSummary('Комплексний', filteredComplex, r => r.overallPassed, null);

        // Total row
        const allItems = [...filteredDesk, ...filteredGame, ...filteredQuiz, ...filteredComplex];
        if (allItems.length) {
            const totalPassed = filteredDesk.filter(r => r.passed).length
                + filteredGame.filter(r => r.isWin).length
                + filteredQuiz.filter(r => r.passed).length
                + filteredComplex.filter(r => r.overallPassed).length;
            summaryData.push({
                'Тип': 'ЗАГАЛОМ',
                'Всього': allItems.length,
                'Здали': totalPassed,
                'Не здали': allItems.length - totalPassed,
                'Успішність %': Math.round(totalPassed / allItems.length * 100),
                'Середній %': '—',
            });
        }

        // City breakdown
        const cityMap = {};
        const addCity = (items, cityFn, passedFn) => {
            items.forEach(r => {
                const c = cityFn(r) || 'Невідомо';
                if (!cityMap[c]) cityMap[c] = { total: 0, passed: 0 };
                cityMap[c].total++;
                if (passedFn(r)) cityMap[c].passed++;
            });
        };
        addCity(filteredDesk, r => r.studentCity, r => r.passed);
        addCity(filteredGame, r => r.playerCity, r => r.isWin);
        addCity(filteredQuiz, r => r.studentCity, r => r.passed);
        addCity(filteredComplex, r => r.studentCity, r => r.overallPassed);

        const cityData = Object.entries(cityMap).map(([city, d]) => ({
            'Місто': city,
            'Всього': d.total,
            'Здали': d.passed,
            'Не здали': d.total - d.passed,
            'Успішність %': Math.round(d.passed / d.total * 100),
        })).sort((a, b) => b['Всього'] - a['Всього']);

        if (summaryData.length) {
            const ws = XLSX.utils.json_to_sheet(summaryData);
            autoWidth(ws, summaryData);
            // Add city table below with a gap
            if (cityData.length) {
                XLSX.utils.sheet_add_json(ws, cityData, { origin: `A${summaryData.length + 3}` });
            }
            XLSX.utils.book_append_sheet(wb, ws, 'Зведення');
        }

        // If no sheets at all, add empty one
        if (!wb.SheetNames.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ 'Немає даних': '' }]), 'Пусто');
        }

        XLSX.writeFile(wb, filename);
    };

    const tabs = [
        { key: 'desk', icon: '🍽️', label: 'Накриття столу', count: filteredDesk.length },
        { key: 'game', icon: '🎮', label: 'Гра (Choice)', count: filteredGame.length },
        { key: 'quiz', icon: '📝', label: 'Квізи', count: filteredQuiz.length },
        { key: 'complex', icon: '🧩', label: 'Комплексний', count: filteredComplex.length },
    ];

    return (
        <div className="tr-page">
            {/* Header */}
            <div className="tr-header">
                <div className="tr-header-left">
                    <h2 className="tr-title">
                        Результати {isAdminCityOnly ? <span className="tr-city-badge">{user.city}</span> : ''}
                    </h2>
                </div>
                <div className="tr-header-right">
                    {['superadmin', 'admin', 'trainer'].includes(user?.role) && (
                        <>
                            <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="tr-select" title="Місто">
                                <option value="">Всі міста</option>
                                {cities.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                            </select>
                            <select value={filterDays} onChange={e => setFilterDays(Number(e.target.value))} className="tr-select" title="Період">
                                <option value={0}>Весь час</option>
                                <option value={7}>7 днів</option>
                                <option value={14}>14 днів</option>
                                <option value={30}>30 днів</option>
                                <option value={90}>90 днів</option>
                                <option value={365}>Рік</option>
                            </select>
                        </>
                    )}
                    <button className="tr-btn tr-btn-ai" onClick={handleAiAnalyze} disabled={aiLoading}>
                        {aiLoading ? '⏳' : '🤖'} AI Аналіз
                    </button>
                    <button className="tr-btn" onClick={exportToExcel}>📊 Excel</button>
                    <button className="tr-btn" onClick={fetchAll}>🔄</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tr-tabs">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        className={`tr-tab ${tab === t.key ? 'active' : ''}`}
                        onClick={() => { setTab(t.key); setSearch(''); }}
                    >
                        <span>{t.icon} {t.label}</span>
                        {t.count > 0 && <span className="tr-tab-count">{t.count}</span>}
                    </button>
                ))}
            </div>

            {/* Stats strip */}
            {!loading && <StatsStrip items={currentFiltered} tab={tab} />}

            {/* Toolbar */}
            <div className="tr-toolbar">
                <div className="tr-search-wrap">
                    <span className="tr-search-icon">🔍</span>
                    <input
                        className="tr-search"
                        placeholder="Пошук за ім'ям або містом..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && <button className="tr-search-clear" onClick={() => setSearch('')}>✕</button>}
                </div>
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="tr-select">
                    <option value="newest">Спочатку нові</option>
                    <option value="oldest">Спочатку старі</option>
                </select>
                {currentFiltered.length > 0 && (
                    <span className="tr-count-label">{currentFiltered.length} записів</span>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="tr-loading">
                    <div className="tr-spinner" />
                    <span>Завантаження...</span>
                </div>
            ) : Object.keys(currentGroups).length === 0 ? (
                <div className="tr-empty">
                    <div className="tr-empty-icon">📭</div>
                    <div>{search ? 'Нічого не знайдено' : 'Результатів поки немає'}</div>
                </div>
            ) : (
                <div className="tr-groups">
                    {tab === 'desk' && Object.entries(deskGroups).map(([name, items]) => {
                        const passed = items.filter(r => r.passed).length;
                        const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);
                        return (
                            <Group key={name} icon="🍽️" name={name} isOpen={isOpen(name)} onToggle={() => toggleGroup(name)}
                                chips={<>
                                    <Chip>{items.length} спроб</Chip>
                                    <Chip color="green">{passed} здали</Chip>
                                    <Chip color="blue">~{avg}%</Chip>
                                </>}
                            >
                                {items.map(r => (
                                    <ResultCard key={r._id} onClick={() => openDetail('desk', r)}
                                        passed={r.passed}
                                        avatarText={initials(r.studentLastName, r.studentName)}
                                        name={`${r.studentLastName} ${r.studentName}`}
                                        sub={r.studentPosition || '—'}
                                        city={r.studentCity}
                                        date={formatDate(r.completedAt)}
                                        score={<>
                                            <strong className={r.passed ? 'clr-green' : 'clr-red'}>{r.percentage}%</strong>
                                            <span className={`tr-pill ${r.passed ? 'pass' : 'fail'}`}>{r.passed ? 'Здано' : 'Не здано'}</span>
                                        </>}
                                    />
                                ))}
                            </Group>
                        );
                    })}

                    {tab === 'game' && Object.entries(gameGroups).map(([name, items]) => {
                        const wins = items.filter(r => r.isWin).length;
                        return (
                            <Group key={name} icon="🎮" name={name} isOpen={isOpen(name)} onToggle={() => toggleGroup(name)}
                                chips={<>
                                    <Chip>{items.length} проходжень</Chip>
                                    <Chip color="green">{wins} перемог</Chip>
                                    <Chip color="red">{items.length - wins} поразок</Chip>
                                </>}
                            >
                                {items.map(r => (
                                    <ResultCard key={r._id} onClick={() => openDetail('game', r)}
                                        passed={r.isWin}
                                        avatarText={initials(r.playerLastName, r.playerName)}
                                        name={`${r.playerLastName} ${r.playerName}`}
                                        sub={r.playerPosition || '—'}
                                        city={r.playerCity}
                                        date={formatDate(r.completedAt)}
                                        extra={<span className="tr-ending">{r.endingTitle || '—'}</span>}
                                        score={<span className={`tr-pill ${r.isWin ? 'pass' : 'fail'}`}>{r.isWin ? 'Перемога' : 'Поразка'}</span>}
                                    />
                                ))}
                            </Group>
                        );
                    })}

                    {tab === 'quiz' && Object.entries(quizGroups).map(([name, items]) => {
                        const passed = items.filter(r => r.passed).length;
                        const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);
                        return (
                            <Group key={name} icon="📝" name={name} isOpen={isOpen(name)} onToggle={() => toggleGroup(name)}
                                chips={<>
                                    <Chip>{items.length} спроб</Chip>
                                    <Chip color="green">{passed} здали</Chip>
                                    <Chip color="blue">~{avg}%</Chip>
                                </>}
                            >
                                {items.map(r => (
                                    <ResultCard key={r._id} onClick={() => openDetail('quiz', r)}
                                        passed={r.passed}
                                        avatarText={initials(r.studentLastName, r.studentName)}
                                        name={`${r.studentLastName} ${r.studentName}`}
                                        sub={r.studentPosition || '—'}
                                        city={r.studentCity}
                                        date={formatDate(r.completedAt)}
                                        score={<>
                                            <strong className={r.passed ? 'clr-green' : 'clr-red'}>{r.percentage}%</strong>
                                            <span className={`tr-pill ${r.passed ? 'pass' : 'fail'}`}>{r.passed ? 'Здано' : 'Не здано'}</span>
                                        </>}
                                    />
                                ))}
                            </Group>
                        );
                    })}

                    {tab === 'complex' && Object.entries(complexGroups).map(([name, items]) => {
                        const passed = items.filter(r => r.overallPassed).length;
                        return (
                            <Group key={name} icon="🧩" name={name} isOpen={isOpen(name)} onToggle={() => toggleGroup(name)}
                                chips={<>
                                    <Chip>{items.length} проходжень</Chip>
                                    <Chip color="green">{passed} пройшли</Chip>
                                    <Chip color="red">{items.length - passed} провалено</Chip>
                                </>}
                            >
                                {items.map(r => (
                                    <ResultCard key={r._id} onClick={() => openDetail('complex', r)}
                                        passed={r.overallPassed}
                                        avatarText={initials(r.studentLastName, r.studentName)}
                                        name={`${r.studentLastName} ${r.studentName}`}
                                        sub={r.studentPosition || '—'}
                                        city={r.studentCity}
                                        date={formatDate(r.completedAt)}
                                        extra={<span className="tr-steps-count">{r.steps?.length || 0} кроків</span>}
                                        score={<span className={`tr-pill ${r.overallPassed ? 'pass' : 'fail'}`}>{r.overallPassed ? 'Пройдено' : 'Не здано'}</span>}
                                    />
                                ))}
                            </Group>
                        );
                    })}
                </div>
            )}

            {/* AI Modal */}
            <DetailModal
                show={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                title="🤖 AI Аналіз результатів"
            >
                <div className="tr-ai-content">
                    {aiLoading ? (
                        <div className="tr-ai-loading">
                            <div className="tr-spinner" />
                            <p>AI аналізує дані...</p>
                        </div>
                    ) : (
                        <div className="tr-ai-text">{aiAnalysis}</div>
                    )}
                </div>
            </DetailModal>

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
                {detailType === 'desk' && detailItem && <DeskDetail item={detailItem} cities={cities} canEdit={canEditCity} onCityChange={c => updateCity('desk', detailItem._id, c)} />}
                {detailType === 'game' && detailItem && <GameDetail item={detailItem} cities={cities} canEdit={canEditCity} onCityChange={c => updateCity('game', detailItem._id, c)} />}
                {detailType === 'quiz' && detailItem && <QuizDetail item={detailItem} cities={cities} canEdit={canEditCity} onCityChange={c => updateCity('quiz', detailItem._id, c)} />}
                {detailType === 'complex' && detailItem && <ComplexDetail item={detailItem} cities={cities} canEdit={canEditCity} onCityChange={c => updateCity('complex', detailItem._id, c)} />}
            </DetailModal>
        </div>
    );
};

const Chip = ({ children, color }) => (
    <span className={`tr-chip ${color || ''}`}>{children}</span>
);

export default TestResults;
