import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './QuizBuilder.css';

const QuizBuilder = () => {
    const [quizzes, setQuizzes] = useState([]);
    const [editing, setEditing] = useState(null);
    const [collapsedQuestions, setCollapsedQuestions] = useState(new Set());
    const [copyStatus, setCopyStatus] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/quiz`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setQuizzes(res.data);
        } catch (err) {
            console.error('fetchQuizzes:', err);
        }
    };

    const handleNewQuiz = () => {
        setEditing({
            title: '',
            description: '',
            timeLimit: 0,
            passingScore: 80,
            questions: [{ text: '', options: ['', '', '', ''], correctIndex: 0, image: '' }]
        });
        setCollapsedQuestions(new Set());
    };

    const addQuestion = () => {
        const newQs = [...editing.questions, { text: '', options: ['', '', '', ''], correctIndex: 0, image: '' }];
        setEditing({ ...editing, questions: newQs });
        // New question is expanded
        const newCollapsed = new Set(collapsedQuestions);
        newCollapsed.delete(newQs.length - 1);
        setCollapsedQuestions(newCollapsed);
    };

    const removeQuestion = (index) => {
        const newQs = editing.questions.filter((_, i) => i !== index);
        setEditing({ ...editing, questions: newQs });
    };

    const isQuestionComplete = (q) => {
        return q.text.trim() !== '' && q.options.every(opt => opt.trim() !== '');
    };

    const checkAutoCollapse = (index, question) => {
        if (isQuestionComplete(question)) {
            const newCollapsed = new Set(collapsedQuestions);
            newCollapsed.add(index);
            setCollapsedQuestions(newCollapsed);
        }
    };

    const toggleCollapse = (index) => {
        const newCollapsed = new Set(collapsedQuestions);
        if (newCollapsed.has(index)) newCollapsed.delete(index);
        else newCollapsed.add(index);
        setCollapsedQuestions(newCollapsed);
    };

    const updateQuestion = (index, field, value) => {
        const newQs = [...editing.questions];
        newQs[index][field] = value;
        setEditing({ ...editing, questions: newQs });
        if (field === 'text') checkAutoCollapse(index, newQs[index]);
    };

    const addOption = (qIdx) => {
        const newQs = [...editing.questions];
        newQs[qIdx].options.push('');
        setEditing({ ...editing, questions: newQs });
    };

    const updateOption = (qIdx, oIdx, value) => {
        const newQs = [...editing.questions];
        newQs[qIdx].options[oIdx] = value;
        setEditing({ ...editing, questions: newQs });
        checkAutoCollapse(qIdx, newQs[qIdx]);
    };

    const removeOption = (qIdx, oIdx) => {
        const newQs = [...editing.questions];
        newQs[qIdx].options = newQs[qIdx].options.filter((_, i) => i !== oIdx);
        if (newQs[qIdx].correctIndex >= newQs[qIdx].options.length) {
            newQs[qIdx].correctIndex = 0;
        }
        setEditing({ ...editing, questions: newQs });
    };

    const handleSave = async () => {
        if (!editing.title.trim()) { alert('Введіть назву квізу'); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (editing._id) {
                await axios.put(`${API_URL}/quiz/${editing._id}`, editing, config);
            } else {
                await axios.post(`${API_URL}/quiz`, editing, config);
            }
            fetchQuizzes();
            setEditing(null);
        } catch (err) {
            console.error('handleSave:', err);
            alert('Помилка при збереженні');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Ви впевнені?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/quiz/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchQuizzes();
        } catch (err) {
            console.error('handleDelete:', err);
        }
    };

    const handleCopyLink = (hash) => {
        const url = `${window.location.origin}/quiz/${hash}`;
        navigator.clipboard.writeText(url);
        setCopyStatus(hash);
        setTimeout(() => setCopyStatus(null), 2000);
    };

    if (editing) {
        return (
            <div className="quiz-builder-editor">
                <header className="qb-header">
                    <div className="qb-header-info">
                        <h1>{editing._id ? 'Редагувати квіз' : 'Новий квіз'}</h1>
                        <input
                            className="qb-title-input"
                            value={editing.title}
                            onChange={e => setEditing({ ...editing, title: e.target.value })}
                            placeholder="Назва квізу..."
                        />
                    </div>
                    <div className="qb-header-actions">
                        <button className="qb-btn qb-btn-secondary" onClick={() => setEditing(null)}>Скасувати</button>
                        <button className="qb-btn qb-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Збереження...' : 'Зберегти квіз'}
                        </button>
                    </div>
                </header>

                <main className="qb-main">
                    <div className="qb-section">
                        <label className="qb-label">Опис</label>
                        <textarea
                            className="qb-textarea"
                            value={editing.description}
                            onChange={e => setEditing({ ...editing, description: e.target.value })}
                            placeholder="Короткий опис для студентів..."
                        />
                    </div>

                    <div className="qb-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="qb-section">
                            <label className="qb-label">Час на тест (хв)</label>
                            <input
                                type="number"
                                className="qb-input"
                                value={editing.timeLimit}
                                onChange={e => setEditing({ ...editing, timeLimit: parseInt(e.target.value) || 0 })}
                                placeholder="0 = без ліміту"
                            />
                        </div>
                        <div className="qb-section">
                            <label className="qb-label">Прохідний бал (%)</label>
                            <input
                                type="number"
                                className="qb-input"
                                value={editing.passingScore}
                                onChange={e => setEditing({ ...editing, passingScore: parseInt(e.target.value) || 80 })}
                            />
                        </div>
                    </div>

                    <div className="qb-questions-list">
                        <div className="qb-section-header">
                            <h3>Питання ({editing.questions.length})</h3>
                            <button className="qb-btn qb-btn-outline" onClick={addQuestion}>+ Додати питання</button>
                        </div>

                        {editing.questions.map((q, qIdx) => {
                            const isCollapsed = collapsedQuestions.has(qIdx);
                            return (
                                <div key={qIdx} className={`qb-question-card ${isCollapsed ? 'collapsed' : ''}`}>
                                    <div className="qb-q-header" onClick={() => toggleCollapse(qIdx)}>
                                        <div className="qb-q-header-left">
                                            <span className="qb-q-number">#{qIdx + 1}</span>
                                            {isCollapsed && <span className="qb-q-preview">{q.text || 'Питання без тексту'}</span>}
                                        </div>
                                        <div className="qb-q-actions">
                                            <button className="qb-q-collapse-btn">{isCollapsed ? '🔼' : '🔽'}</button>
                                            <button className="qb-q-remove" onClick={(e) => { e.stopPropagation(); removeQuestion(qIdx); }}>×</button>
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <>
                                            <input
                                                className="qb-input qb-q-text"
                                                value={q.text}
                                                onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                                                placeholder="Текст питання..."
                                            />

                                            <div className="qb-section" style={{ marginBottom: '1rem' }}>
                                                <label className="qb-label" style={{ fontSize: '0.75rem' }}>URL Зображення (необов'язково)</label>
                                                <input
                                                    className="qb-input"
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                                                    value={q.image || ''}
                                                    onChange={e => updateQuestion(qIdx, 'image', e.target.value)}
                                                    placeholder="https://example.com/image.jpg"
                                                />
                                            </div>

                                            <div className="qb-options-grid">
                                                {q.options.map((opt, oIdx) => (
                                                    <div key={oIdx} className={`qb-option-item ${q.correctIndex === oIdx ? 'correct' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name={`q-${qIdx}`}
                                                            checked={q.correctIndex === oIdx}
                                                            onChange={() => updateQuestion(qIdx, 'correctIndex', oIdx)}
                                                        />
                                                        <input
                                                            className="qb-input-mini"
                                                            value={opt}
                                                            onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                                                            placeholder={`Варіант ${oIdx + 1}`}
                                                        />
                                                        {q.options.length > 2 && (
                                                            <button className="qb-opt-remove" onClick={() => removeOption(qIdx, oIdx)}>×</button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button className="qb-btn-add-opt" onClick={() => addOption(qIdx)}>+ Додати варіант</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="quiz-builder">
            <header className="quiz-header">
                <div>
                    <h1>Квізи (Тести)</h1>
                    <p>Керуйте текстовими тестами для персоналу</p>
                </div>
                <button className="qb-btn qb-btn-primary" onClick={handleNewQuiz}>+ Створити квіз</button>
            </header>

            <div className="quiz-grid">
                {quizzes.length === 0 ? (
                    <div className="qb-empty">
                        <span className="qb-empty-icon">📝</span>
                        <h3>Немає створених квізів</h3>
                        <p>Натисніть кнопку вище, щоб створити свій перший тест</p>
                    </div>
                ) : (
                    quizzes.map(quiz => (
                        <div key={quiz._id} className="quiz-card">
                            <div className="quiz-card-content">
                                <h3>{quiz.title}</h3>
                                <p>{quiz.description || 'Без опису'}</p>
                                <div className="quiz-meta">
                                    <span>❓ {quiz.questions.length} питань</span>
                                    <span>📅 {new Date(quiz.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="quiz-card-actions">
                                <button className="qb-btn qb-btn-secondary" onClick={() => handleCopyLink(quiz.hash)}>
                                    {copyStatus === quiz.hash ? '✓ Скопійовано' : '🔗 Посилання'}
                                </button>
                                <button className="qb-btn-icon" onClick={() => setEditing(quiz)} title="Редагувати">✏️</button>
                                <button className="qb-btn-icon delete" onClick={() => handleDelete(quiz._id)} title="Видалити">🗑️</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default QuizBuilder;
