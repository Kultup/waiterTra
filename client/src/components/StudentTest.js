import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './VirtualDesk.css';
import API_URL from '../api';

const dishList = [
    { id: 'plate', name: 'Тарілка', icon: '🍽️' },
    { id: 'glass', name: 'Склянка', icon: '🍷' },
    { id: 'fork', name: 'Виделка', icon: '🍴' },
    { id: 'knife', name: 'Ніж', icon: '🔪' },
    { id: 'spoon', name: 'Ложка', icon: '🥄' },
    { id: 'coffee', name: 'Кава', icon: '☕' },
];

const StudentTest = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [testData, setTestData] = useState(null);
    const [items, setItems] = useState([]);
    const [selectedDish, setSelectedDish] = useState(dishList[0]);
    const [testResult, setTestResult] = useState(null);
    const [loading, setLoading] = useState(true);

    // Registration State
    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({
        lastName: '',
        city: '',
        position: ''
    });

    const [timeLeft, setTimeLeft] = useState(null);
    const handleCheckResultRef = useRef(null);

    useEffect(() => {
        const fetchTest = async () => {
            try {
                const response = await axios.get(`${API_URL}/tests/${hash}`);
                setTestData(response.data);
                if (response.data.city) {
                    setStudentInfo(prev => ({ ...prev, city: response.data.city }));
                }
            } catch (error) {
                console.error('Error fetching test:', error);
                if (error.response?.status === 410) {
                    navigate('/inactive');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchTest();
    }, [hash]);


    // Timer logic
    useEffect(() => {
        if (isRegistered && testData?.templateId?.timeLimit > 0 && !testResult) {
            setTimeLeft(testData.templateId.timeLimit * 60);
        }
    }, [isRegistered, testData, testResult]);

    useEffect(() => {
        if (timeLeft === null || testResult) return;

        if (timeLeft === 0) {
            handleCheckResultRef.current();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, testResult]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    const handleDeskClick = (e) => {
        if (testResult) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const visualX = e.clientX - rect.left;
        const visualY = e.clientY - rect.top;

        // Normalize to logical 500x500 space
        const x = (visualX / rect.width) * 500;
        const y = (visualY / rect.height) * 500;

        const newItem = {
            _id: Date.now().toString(),
            name: selectedDish.name,
            icon: selectedDish.icon,
            x,
            y,
            type: selectedDish.id
        };
        setItems([...items, newItem]);
    };

    const handleDeleteItem = (id) => {
        if (testResult) return;
        setItems(items.filter(item => item._id !== id));
    };

    const handleCheckResult = async () => {
        const payload = {
            items: items.map(({ type, x, y }) => ({ type, x, y })),
            studentName: studentInfo.firstName,
            studentLastName: studentInfo.lastName,
            studentCity: studentInfo.city,
            studentPosition: studentInfo.position,
        };

        try {
            const response = await axios.post(`${API_URL}/tests/${hash}/submit`, payload);
            const { score, total, percentage, passed, validatedItems } = response.data;

            const mergedItems = items.map((item, idx) => ({
                ...item,
                isCorrect: validatedItems[idx]?.isCorrect ?? false,
            }));

            setItems(mergedItems);
            setTestResult({ score, total, percentage, passed });
        } catch (error) {
            console.error('Error submitting test:', error);
            alert('Помилка при відправці результату');
        }
    };

    // Always keep the ref pointing to the latest version of handleCheckResult
    // so the timer effect never captures a stale closure
    handleCheckResultRef.current = handleCheckResult;

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>Реєстрація на тест</h2>
                    <p>Шаблон: <strong>{testData.templateId.name}</strong></p>
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label>Ім'я</label>
                            <input
                                type="text"
                                value={studentInfo.firstName}
                                onChange={(e) => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                                placeholder="Введіть ім'я"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Прізвище</label>
                            <input
                                type="text"
                                value={studentInfo.lastName}
                                onChange={(e) => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                                placeholder="Введіть прізвище"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Місто</label>
                            <input
                                type="text"
                                value={studentInfo.city || '—'}
                                disabled
                                style={{
                                    width: '100%',
                                    padding: '12px 15px',
                                    borderRadius: '8px',
                                    border: '1px solid #333',
                                    background: '#1a1a1a',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    opacity: 0.7,
                                    cursor: 'not-allowed'
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Посада</label>
                            <input
                                type="text"
                                value={studentInfo.position}
                                onChange={(e) => setStudentInfo({ ...studentInfo, position: e.target.value })}
                                placeholder="Введіть посаду"
                                required
                            />
                        </div>
                        <button type="submit" className="btn-save-template" style={{ width: '100%', marginTop: '1rem' }}>
                            Почати тест
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className={`virtual-desk-container student-test ${testResult ? 'has-result' : ''}`}>
            <header className="desk-header">
                <div className="header-info">
                    <h1>🍽️ {testData.templateId.name}</h1>
                    <p>{studentInfo.firstName} {studentInfo.lastName} · {studentInfo.city} ({studentInfo.position})</p>
                </div>
                <div className="header-actions">
                    {timeLeft !== null && !testResult && (
                        <span className={`test-timer ${timeLeft < 60 ? 'timer-warning' : ''}`}
                            style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            ⏱ {formatTime(timeLeft)}
                        </span>
                    )}
                    {!testResult && (
                        <button className="btn-add" onClick={handleCheckResult} disabled={items.length === 0}>
                            Перевірити результат
                        </button>
                    )}
                </div>
            </header>

            <div className="desk-body">
                <aside className="desk-panel inventory-panel">
                    <div className="panel-label">Посуд</div>
                    <div className="inventory-grid">
                        {dishList.map(dish => (
                            <div
                                key={dish.id}
                                className={`inv-item ${selectedDish.id === dish.id ? 'active' : ''}`}
                                onClick={() => !testResult && setSelectedDish(dish)}
                            >
                                <span className="inv-icon">{dish.icon}</span>
                                <span className="inv-name">{dish.name}</span>
                            </div>
                        ))}
                    </div>
                </aside>

                <div className="desk-workspace">
                    <div className="square-desk" onClick={handleDeskClick}>
                        {testResult && testData.templateId.items.map((target, idx) => (
                            <div
                                key={`ghost-${idx}`}
                                className="desk-item ghost-item"
                                style={{
                                    left: `${(target.x / 500) * 100}%`,
                                    top: `${(target.y / 500) * 100}%`
                                }}
                            >
                                <span className="item-icon">{target.icon}</span>
                            </div>
                        ))}
                        {items.map((item) => (
                            <div
                                key={item._id}
                                className={`desk-item ${testResult ? (item.isCorrect ? 'correct' : 'incorrect') : ''}`}
                                style={{
                                    left: `${(item.x / 500) * 100}%`,
                                    top: `${(item.y / 500) * 100}%`
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span className="item-icon">{item.icon}</span>
                                <span className="item-text">{item.name}</span>
                                {!testResult && (
                                    <button className="item-delete" onClick={() => handleDeleteItem(item._id)}>×</button>
                                )}
                            </div>
                        ))}
                        {items.length === 0 && !testResult && (
                            <div className="desk-placeholder">
                                <span className="desk-icon">📋</span>
                                <span className="desk-label">Розпочніть сервірування</span>
                            </div>
                        )}
                    </div>
                </div>

                {testResult && (
                    <aside className="desk-panel results-panel">
                        <div className="panel-label">Результат</div>
                        <div className="result-card">
                            <div className="result-score" style={{ color: testResult.passed ? '#4ade80' : '#f87171' }}>
                                {testResult.percentage}%
                            </div>
                            <p>Правильно: {testResult.score} з {testResult.total}</p>
                            <p className="result-status">
                                {testResult.passed ? '✅ Тест пройдено!' : '❌ Спробуйте ще раз'}
                            </p>
                            <p className="result-hint">Адміністратор отримав ваші результати</p>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default StudentTest;
