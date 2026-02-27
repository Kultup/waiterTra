import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './VirtualDesk.css';
import './MultiDeskTest.css';
import API_URL from '../api';

const dishList = [
    { id: 'plate', name: 'Тарілка', icon: '🍽️' },
    { id: 'glass', name: 'Склянка', icon: '🍷' },
    { id: 'fork', name: 'Виделка', icon: '🍴' },
    { id: 'knife', name: 'Ніж', icon: '🔪' },
    { id: 'spoon', name: 'Ложка', icon: '🥄' },
    { id: 'coffee', name: 'Кава', icon: '☕' },
];

const MultiDeskTest = () => {
    const { hash } = useParams();
    const [testData, setTestData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Registration
    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '' });

    // Step state
    const [currentStep, setCurrentStep] = useState(0);
    const [items, setItems] = useState([]);
    const [selectedDish, setSelectedDish] = useState(dishList[0]);
    const [stepResults, setStepResults] = useState([]);
    const [stepResult, setStepResult] = useState(null);

    // Timer
    const [timeLeft, setTimeLeft] = useState(null);
    const handleCheckRef = useRef(null);

    // Summary
    const [showSummary, setShowSummary] = useState(false);
    const [serverResults, setServerResults] = useState(null);

    useEffect(() => {
        const fetchTest = async () => {
            try {
                const res = await axios.get(`${API_URL}/tests/multi/${hash}`);
                setTestData(res.data);
            } catch (err) {
                console.error('Error fetching multi-test:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTest();
    }, [hash]);

    const templates = testData?.templateIds || [];
    const currentTemplate = templates[currentStep];

    // Timer logic
    useEffect(() => {
        if (isRegistered && currentTemplate?.timeLimit > 0 && !stepResult) {
            setTimeLeft(currentTemplate.timeLimit * 60);
        } else if (!currentTemplate?.timeLimit) {
            setTimeLeft(null);
        }
    }, [isRegistered, currentStep, currentTemplate, stepResult]);

    useEffect(() => {
        if (timeLeft === null || stepResult) return;
        if (timeLeft === 0) { handleCheckRef.current(); return; }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, stepResult]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.city) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    const handleDeskClick = (e) => {
        if (stepResult) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 500;
        const y = (e.clientY - rect.top) / rect.height * 500;
        const newItem = {
            _id: Date.now().toString(),
            name: selectedDish.name, icon: selectedDish.icon,
            x, y, type: selectedDish.id
        };
        setItems(prev => [...prev, newItem]);
    };

    const handleDeleteItem = (id) => {
        if (stepResult) return;
        setItems(prev => prev.filter(i => i._id !== id));
    };

    const handleCheckResult = () => {
        if (!currentTemplate) return;
        const tolerance = 50;
        const targetItems = currentTemplate.items;
        let score = 0;

        const validatedItems = items.map(userItem => {
            const match = targetItems.find(t =>
                userItem.type === t.type &&
                Math.abs(userItem.x - t.x) < tolerance &&
                Math.abs(userItem.y - t.y) < tolerance
            );
            return { ...userItem, isCorrect: !!match };
        });

        targetItems.forEach(target => {
            const found = items.some(ui =>
                ui.type === target.type &&
                Math.abs(ui.x - target.x) < tolerance &&
                Math.abs(ui.y - target.y) < tolerance
            );
            if (found) score++;
        });

        const total = targetItems.length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= 80;

        setItems(validatedItems);
        const result = { score, total, percentage, passed };
        setStepResult(result);
        setStepResults(prev => [...prev, { ...result, items: items.map(({ type, x, y }) => ({ type, x, y })) }]);
    };

    handleCheckRef.current = handleCheckResult;

    const handleNext = async () => {
        if (currentStep < templates.length - 1) {
            setCurrentStep(prev => prev + 1);
            setItems([]);
            setStepResult(null);
            setSelectedDish(dishList[0]);
        } else {
            // All done — submit to server
            try {
                const res = await axios.post(`${API_URL}/tests/multi/${hash}/submit`, {
                    studentName: studentInfo.firstName,
                    studentLastName: studentInfo.lastName,
                    studentCity: studentInfo.city,
                    results: stepResults.map(r => ({ items: r.items }))
                });
                setServerResults(res.data.stepResults);
            } catch (e) {
                console.error('Submit error:', e);
            }
            setShowSummary(true);
        }
    };

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    // Registration screen
    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>Комплексний тест сервірування</h2>
                    <p>Всього сервіровок: <strong>{templates.length}</strong></p>
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label>Ім'я</label>
                            <input type="text" value={studentInfo.firstName}
                                onChange={e => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                                placeholder="Введіть ім'я" required />
                        </div>
                        <div className="form-group">
                            <label>Прізвище</label>
                            <input type="text" value={studentInfo.lastName}
                                onChange={e => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                                placeholder="Введіть прізвище" required />
                        </div>
                        <div className="form-group">
                            <label>Місто</label>
                            <input type="text" value={studentInfo.city}
                                onChange={e => setStudentInfo({ ...studentInfo, city: e.target.value })}
                                placeholder="Введіть місто" required />
                        </div>
                        <button type="submit" className="btn-save-template" style={{ width: '100%', marginTop: '1rem' }}>
                            Почати тест
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Summary screen
    if (showSummary) {
        const results = serverResults || stepResults;
        const totalScore = results.reduce((s, r) => s + r.score, 0);
        const totalMax = results.reduce((s, r) => s + r.total, 0);
        const overallPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
        const allPassed = results.every(r => r.passed);

        return (
            <div className="multi-desk-container">
                <div className="multi-summary">
                    <h2>📋 Зведений результат</h2>
                    <table className="summary-table">
                        <thead>
                            <tr><th>Сервіровка</th><th>Бали</th><th>%</th><th>Статус</th></tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={i} className={r.passed ? 'passed-row' : 'failed-row'}>
                                    <td>{r.templateName || templates[i]?.name || `#${i + 1}`}</td>
                                    <td>{r.score}/{r.total}</td>
                                    <td>{r.percentage}%</td>
                                    <td>{r.passed ? '✅' : '❌'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="overall-result">
                        <div className="overall-score" style={{ color: allPassed ? '#4ade80' : '#f87171' }}>
                            {overallPercent}%
                        </div>
                        <p className="overall-status">
                            {allPassed ? '✅ Всі сервіровки пройдено!' : '❌ Деякі сервіровки не пройдено'}
                        </p>
                    </div>
                    <button className="btn-save-template" onClick={() => window.location.reload()}>
                        Повторити
                    </button>
                </div>
            </div>
        );
    }

    // Test step
    return (
        <div className="multi-desk-container">
            {/* Stepper */}
            <div className="stepper">
                {templates.map((t, i) => (
                    <div key={i} className="stepper-step">
                        <div className={`step-circle ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                            {i < currentStep ? '✓' : i + 1}
                        </div>
                        {i < templates.length - 1 && (
                            <div className={`step-line ${i < currentStep ? 'done' : ''}`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="step-header">
                <h2>🍽️ {currentTemplate?.name}</h2>
                <p>{studentInfo.firstName} {studentInfo.lastName} · Крок {currentStep + 1} з {templates.length}</p>
            </div>

            <div className={`virtual-desk-container student-test ${stepResult ? 'has-result' : ''}`} style={{ flex: 1 }}>
                <header className="desk-header">
                    <div className="header-info">
                        <p>На столі: {items.length} предметів</p>
                    </div>
                    <div className="header-actions">
                        {timeLeft !== null && !stepResult && (
                            <span className={`test-timer ${timeLeft < 60 ? 'timer-warning' : ''}`}
                                style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                ⏱ {formatTime(timeLeft)}
                            </span>
                        )}
                        {!stepResult && (
                            <button className="btn-add" onClick={handleCheckResult} disabled={items.length === 0}>
                                Перевірити
                            </button>
                        )}
                        {stepResult && (
                            <button className="btn-save-template" onClick={handleNext}>
                                {currentStep < templates.length - 1 ? 'Далі →' : 'Завершити'}
                            </button>
                        )}
                    </div>
                </header>

                <div className="desk-body">
                    <aside className="desk-panel inventory-panel">
                        <div className="panel-label">Посуд</div>
                        <div className="inventory-grid">
                            {dishList.map(dish => (
                                <div key={dish.id}
                                    className={`inv-item ${selectedDish.id === dish.id ? 'active' : ''}`}
                                    onClick={() => !stepResult && setSelectedDish(dish)}>
                                    <span className="inv-icon">{dish.icon}</span>
                                    <span className="inv-name">{dish.name}</span>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <div className="desk-workspace">
                        <div className="square-desk" onClick={handleDeskClick}>
                            {stepResult && currentTemplate.items.map((target, idx) => (
                                <div key={`ghost-${idx}`} className="desk-item ghost-item"
                                    style={{ left: `${(target.x / 500) * 100}%`, top: `${(target.y / 500) * 100}%` }}>
                                    <span className="item-icon">{target.icon}</span>
                                </div>
                            ))}
                            {items.map(item => (
                                <div key={item._id}
                                    className={`desk-item ${stepResult ? (item.isCorrect ? 'correct' : 'incorrect') : ''}`}
                                    style={{ left: `${(item.x / 500) * 100}%`, top: `${(item.y / 500) * 100}%` }}
                                    onClick={e => e.stopPropagation()}>
                                    <span className="item-icon">{item.icon}</span>
                                    <span className="item-text">{item.name}</span>
                                    {!stepResult && (
                                        <button className="item-delete" onClick={() => handleDeleteItem(item._id)}>×</button>
                                    )}
                                </div>
                            ))}
                            {items.length === 0 && !stepResult && (
                                <div className="desk-placeholder">
                                    <span className="desk-icon">📋</span>
                                    <span className="desk-label">Розпочніть сервірування</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {stepResult && (
                        <aside className="desk-panel results-panel">
                            <div className="panel-label">Результат</div>
                            <div className="result-card">
                                <div className="result-score" style={{ color: stepResult.passed ? '#4ade80' : '#f87171' }}>
                                    {stepResult.percentage}%
                                </div>
                                <p>Правильно: {stepResult.score} з {stepResult.total}</p>
                                <p className="result-status">
                                    {stepResult.passed ? '✅ Пройдено!' : '❌ Не пройдено'}
                                </p>
                            </div>
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MultiDeskTest;
