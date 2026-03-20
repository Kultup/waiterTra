import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ComplexTestBuilder.css';
import API_URL, { getUserPlatform } from '../api';
import ConfirmModal from './ConfirmModal';

const typeLabels = { desk: '🖥️ Сервіровка', game: '🎮 Гра', quiz: '📝 Квіз' };

const ComplexTestBuilder = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [targetCity, setTargetCity] = useState('');
    const [cities, setCities] = useState([]);
    const [filterCity, setFilterCity] = useState('');

    // Available items
    const [available, setAvailable] = useState({ templates: [], scenarios: [], quizzes: [] });
    const [savedTests, setSavedTests] = useState([]);
    const [copyStatus, setCopyStatus] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });

    useEffect(() => {
        fetchUser();
        fetchData();
        fetchCities();
    }, []);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`);
            setCities(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const [availRes, testsRes] = await Promise.all([
                axios.get(`${API_URL}/complex-tests/available-items`, config),
                axios.get(`${API_URL}/complex-tests`, config)
            ]);
            setAvailable(availRes.data);
            setSavedTests(testsRes.data);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const addStep = (type, item) => {
        const step = {
            type,
            refId: item._id,
            title: item.title || item.name || item.templateName,
            timeLimit: item.timeLimit || 0
        };
        setSteps(prev => [...prev, step]);
    };

    const removeStep = (index) => {
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    const moveStep = (index, dir) => {
        const newSteps = [...steps];
        const target = index + dir;
        if (target < 0 || target >= newSteps.length) return;
        [newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]];
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!title.trim()) { alert('Введіть назву тесту'); return; }
        if (steps.length === 0) { alert('Додайте хоча б один крок'); return; }

        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const payload = {
                title: title.trim(),
                description: description.trim(),
                steps,
                targetCity: user?.role === 'superadmin' ? targetCity : undefined
            };

            if (editingId) {
                await axios.put(`${API_URL}/complex-tests/${editingId}`, payload, config);
            } else {
                await axios.post(`${API_URL}/complex-tests`, payload, config);
            }

            setTitle('');
            setDescription('');
            setSteps([]);
            setTargetCity('');
            setEditingId(null);
            fetchData();
        } catch (e) {
            console.error('Save error:', e);
            const msg = e.response?.data?.error || e.message || 'Невідома помилка';
            alert(`Помилка при збереженні: ${msg}`);
        }
    };

    const handleEdit = (test) => {
        setEditingId(test._id);
        setTitle(test.title);
        setDescription(test.description || '');
        setSteps(test.steps || []);
        setTargetCity(test.targetCity || '');
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.idToDelete;
        if (!id) return;
        setConfirmModal({ isOpen: false, idToDelete: null });
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/complex-tests/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (editingId === id) {
                setEditingId(null); setTitle(''); setDescription(''); setSteps([]); setTargetCity('');
            }
            fetchData();
        } catch (e) {
            alert('Помилка при видаленні');
        }
    };

    const handleCopyLink = async (complexTestId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/complex-tests/links`, { complexTestId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const url = `${window.location.origin}/complex/${res.data.hash}`;
            await navigator.clipboard.writeText(url);
            setCopyStatus(complexTestId);
            setTimeout(() => setCopyStatus(null), 3000);
        } catch (e) {
            console.error('handleCopyLink error:', e);
            alert('Помилка копіювання');
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setSteps([]);
        setTargetCity('');
    };

    if (loading) return <div className="placeholder-view">Завантаження...</div>;

    return (
        <div className="complex-builder">
            <header className="complex-builder-header">
                <div>
                    <h1>{editingId ? '✏️ Редагування' : '🧩 Комплексний тест'}</h1>
                    <p>{editingId ? 'Змініть кроки та збережіть' : 'Об\'єднайте сервіровки, ігри та квізи в один тест'}</p>
                </div>
                <div className="builder-actions">
                    {editingId && (
                        <button className="btn-header-ghost btn-cancel-edit" onClick={cancelEdit}>
                            Скасувати
                        </button>
                    )}
                    <button className="btn-save-template" onClick={handleSave}>
                        {editingId ? '💾 Оновити' : '💾 Зберегти'}
                    </button>
                </div>
            </header>

            <div className="builder-body">
                <div className="builder-main">
                    <div className="builder-field">
                        <label>Назва тесту</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Наприклад: Повний тест офіціанта" />
                    </div>
                    <div className="builder-field">
                        <label>Опис (необов'язково)</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="Короткий опис тесту..." rows={2} />
                    </div>

                    {user?.role === 'superadmin' && (
                        <div className="builder-field">
                            <label>📍 Призначити місту (залиште порожнім для всіх)</label>
                            <select
                                value={targetCity}
                                onChange={e => setTargetCity(e.target.value)}
                                style={{ background: 'transparent', border: '1px solid #444', height: '32px', color: '#fff', padding: '0 10px', borderRadius: '4px', width: '200px' }}
                            >
                                <option value="" style={{ color: '#000' }}>Всі міста</option>
                                {cities.map(c => (
                                    <option key={c._id} value={c.name} style={{ color: '#000' }}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="steps-label">Кроки тесту ({steps.length})</div>
                    {steps.length === 0 ? (
                        <div className="empty-steps">
                            Додайте кроки зі списку справа →
                        </div>
                    ) : (
                        <div className="steps-list">
                            {steps.map((step, idx) => (
                                <div key={idx} className="step-card">
                                    <div className="step-arrows">
                                        <button className="step-arrow" disabled={idx === 0}
                                            onClick={() => moveStep(idx, -1)}>▲</button>
                                        <button className="step-arrow" disabled={idx === steps.length - 1}
                                            onClick={() => moveStep(idx, 1)}>▼</button>
                                    </div>
                                    <div className={`step-number ${step.type}`}>{idx + 1}</div>
                                    <div className="step-info">
                                        <div className="step-title">{step.title}</div>
                                        <div className="step-type">
                                            {typeLabels[step.type]}
                                            {step.timeLimit > 0 && ` · ⏱ ${step.timeLimit} хв`}
                                        </div>
                                    </div>
                                    <button className="step-remove" onClick={() => removeStep(idx)} title="Видалити">×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Saved tests */}
                    {savedTests.length > 0 && (
                        <div className="saved-tests">
                            <div className="steps-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <span>Збережені тести ({savedTests.length})</span>
                                {user?.role === 'superadmin' && (
                                    <div className="city-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 'normal' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#aaa', whiteSpace: 'nowrap' }}>📍 Місто:</span>
                                        <select
                                            value={filterCity}
                                            onChange={e => setFilterCity(e.target.value)}
                                            style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            <option value="" style={{ color: '#000' }}>Всі міста</option>
                                            {cities.map(c => (
                                                <option key={c._id} value={c.name} style={{ color: '#000' }}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {(() => {
                                const filteredTests = savedTests.filter(t => !filterCity || t.targetCity === filterCity);
                                if (filteredTests.length === 0) return <div className="qb-empty" style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>Немає знайдених тестів</div>;

                                return filteredTests.map(test => (
                                    <div key={test._id} className="saved-test-card">
                                        <div className="saved-test-info">
                                            <div className="test-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span>🧩 {test.title}</span>
                                                {test.targetCity && <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 'normal', whiteSpace: 'nowrap' }}>📍 {test.targetCity}</span>}
                                            </div>
                                            <div className="test-meta">{test.steps?.length || 0} кроків</div>
                                        </div>
                                        <div className="saved-test-actions">
                                            {copyStatus === test._id ? (
                                                <span className="saved-copied">✓</span>
                                            ) : (
                                                <button onClick={() => handleCopyLink(test._id)} title="Скопіювати посилання">📋</button>
                                            )}
                                            <button onClick={() => handleEdit(test)} title="Редагувати">✏️</button>
                                            <button className="btn-delete" onClick={() => setConfirmModal({ isOpen: true, idToDelete: test._id })} title="Видалити">×</button>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>

                {/* Right sidebar: available items */}
                <aside className="builder-sidebar">
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">🖥️ Сервіровки</div>
                        <div className="sidebar-items">
                            {available.templates.length === 0 ? (
                                <div className="sidebar-empty">Немає сервіровок</div>
                            ) : available.templates.map(t => (
                                <div key={t._id} className="sidebar-item" onClick={() => addStep('desk', t)}>
                                    <span className="item-icon">🍽️</span>
                                    <span className="item-title">{t.templateName || t.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-label">🎮 Ігри</div>
                        <div className="sidebar-items">
                            {available.scenarios.length === 0 ? (
                                <div className="sidebar-empty">Немає ігор</div>
                            ) : available.scenarios.map(s => (
                                <div key={s._id} className="sidebar-item" onClick={() => addStep('game', s)}>
                                    <span className="item-icon">🎮</span>
                                    <span className="item-title">{s.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-label">📝 Квізи</div>
                        <div className="sidebar-items">
                            {available.quizzes.length === 0 ? (
                                <div className="sidebar-empty">Немає квізів</div>
                            ) : available.quizzes.map(q => (
                                <div key={q._id} className="sidebar-item" onClick={() => addStep('quiz', q)}>
                                    <span className="item-icon">📝</span>
                                    <span className="item-title">{q.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Видалення комплексного тесту"
                message="Ви впевнені, що хочете видалити цей комплексний тест? Цю дію неможливо скасувати."
                confirmText="Видалити"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
            />
        </div>
    );
};

export default ComplexTestBuilder;
