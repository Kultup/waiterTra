import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ComplexTestBuilder.css';
import API_URL from '../api';

const typeLabels = { desk: '🖥️ Сервіровка', game: '🎮 Гра', quiz: '📝 Квіз' };

const ComplexTestBuilder = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState([]);
    const [editingId, setEditingId] = useState(null);

    // Available items
    const [available, setAvailable] = useState({ templates: [], scenarios: [], quizzes: [] });
    const [savedTests, setSavedTests] = useState([]);
    const [copyStatus, setCopyStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

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
            title: item.name || item.title,
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
            const payload = { title: title.trim(), description: description.trim(), steps };

            if (editingId) {
                await axios.put(`${API_URL}/complex-tests/${editingId}`, payload, config);
            } else {
                await axios.post(`${API_URL}/complex-tests`, payload, config);
            }

            setTitle('');
            setDescription('');
            setSteps([]);
            setEditingId(null);
            fetchData();
        } catch (e) {
            console.error('Save error:', e);
            alert('Помилка при збереженні');
        }
    };

    const handleEdit = (test) => {
        setEditingId(test._id);
        setTitle(test.title);
        setDescription(test.description || '');
        setSteps(test.steps || []);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Видалити комплексний тест?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/complex-tests/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (editingId === id) {
                setEditingId(null); setTitle(''); setDescription(''); setSteps([]);
            }
            fetchData();
        } catch (e) {
            alert('Помилка при видаленні');
        }
    };

    const handleCopyLink = async (hash) => {
        const url = `${window.location.origin}/complex/${hash}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopyStatus(hash);
            setTimeout(() => setCopyStatus(null), 3000);
        } catch (e) { alert('Помилка копіювання'); }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setDescription('');
        setSteps([]);
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
                            <div className="steps-label">Збережені тести ({savedTests.length})</div>
                            {savedTests.map(test => (
                                <div key={test._id} className="saved-test-card">
                                    <div className="saved-test-info">
                                        <div className="test-title">🧩 {test.title}</div>
                                        <div className="test-meta">{test.steps?.length || 0} кроків</div>
                                    </div>
                                    <div className="saved-test-actions">
                                        {copyStatus === test.hash ? (
                                            <span className="saved-copied">✓</span>
                                        ) : (
                                            <button onClick={() => handleCopyLink(test.hash)} title="Скопіювати посилання">📋</button>
                                        )}
                                        <button onClick={() => handleEdit(test)} title="Редагувати">✏️</button>
                                        <button className="btn-delete" onClick={() => handleDelete(test._id)} title="Видалити">×</button>
                                    </div>
                                </div>
                            ))}
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
                                    <span className="item-title">{t.name}</span>
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
        </div>
    );
};

export default ComplexTestBuilder;
