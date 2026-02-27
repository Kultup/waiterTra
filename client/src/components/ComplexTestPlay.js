import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import './VirtualDesk.css';
import './ComplexTestPlay.css';
import API_URL from '../api';

const dishList = [
    { id: 'plate', name: 'Тарілка', icon: '🍽️' },
    { id: 'glass', name: 'Склянка', icon: '🍷' },
    { id: 'fork', name: 'Виделка', icon: '🍴' },
    { id: 'knife', name: 'Ніж', icon: '🔪' },
    { id: 'spoon', name: 'Ложка', icon: '🥄' },
    { id: 'coffee', name: 'Кава', icon: '☕' },
];

const ComplexTestPlay = () => {
    const { hash } = useParams();
    const [testData, setTestData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '' });

    const [currentStep, setCurrentStep] = useState(0);
    const [stepResults, setStepResults] = useState([]);
    const [showSummary, setShowSummary] = useState(false);

    // Desk state
    const [deskItems, setDeskItems] = useState([]);
    const [selectedDish, setSelectedDish] = useState(dishList[0]);
    const [deskResult, setDeskResult] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const handleDeskCheckRef = useRef(null);

    // Game state
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [gameEnding, setGameEnding] = useState(null);

    // Quiz state
    const [quizAnswers, setQuizAnswers] = useState({});
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [quizDone, setQuizDone] = useState(false);
    const [quizResult, setQuizResult] = useState(null);

    useEffect(() => {
        const fetchTest = async () => {
            try {
                const res = await axios.get(`${API_URL}/complex-tests/hash/${hash}`);
                setTestData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTest();
    }, [hash]);

    const steps = testData?.steps || [];
    const step = steps[currentStep];

    // Reset step-specific state when step changes
    useEffect(() => {
        if (!step) return;
        setDeskItems([]);
        setDeskResult(null);
        setSelectedDish(dishList[0]);
        setTimeLeft(null);
        setCurrentNodeId(null);
        setGameEnding(null);
        setQuizAnswers({});
        setCurrentQuestion(0);
        setQuizDone(false);
        setQuizResult(null);

        if (step.type === 'game' && step.refData) {
            setCurrentNodeId(step.refData.startNodeId);
        }
    }, [currentStep, step]);

    // Timer for desk steps
    useEffect(() => {
        if (!isRegistered || !step || step.type !== 'desk') return;
        const tl = step.timeLimit || step.refData?.timeLimit || 0;
        if (tl > 0 && !deskResult) {
            setTimeLeft(tl * 60);
        }
    }, [isRegistered, currentStep, step, deskResult]);

    useEffect(() => {
        if (timeLeft === null || deskResult) return;
        if (timeLeft === 0) { handleDeskCheckRef.current?.(); return; }
        const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, deskResult]);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.city) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    // ── Desk handlers ───────────────────────────────────────
    const handleDeskClick = (e) => {
        if (deskResult) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * 500;
        const y = (e.clientY - rect.top) / rect.height * 500;
        setDeskItems(prev => [...prev, {
            _id: Date.now().toString(), name: selectedDish.name,
            icon: selectedDish.icon, x, y, type: selectedDish.id
        }]);
    };

    const handleDeleteDeskItem = (id) => {
        if (deskResult) return;
        setDeskItems(prev => prev.filter(i => i._id !== id));
    };

    const handleDeskCheck = () => {
        const refData = step?.refData;
        if (!refData) return;
        const tolerance = 50;
        const targetItems = refData.items;
        let score = 0;

        const validated = deskItems.map(ui => {
            const match = targetItems.find(t =>
                ui.type === t.type && Math.abs(ui.x - t.x) < tolerance && Math.abs(ui.y - t.y) < tolerance
            );
            return { ...ui, isCorrect: !!match };
        });

        targetItems.forEach(target => {
            if (deskItems.some(ui => ui.type === target.type &&
                Math.abs(ui.x - target.x) < tolerance && Math.abs(ui.y - target.y) < tolerance)) score++;
        });

        const total = targetItems.length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= 80;
        setDeskItems(validated);
        setDeskResult({ score, total, percentage, passed });
    };

    handleDeskCheckRef.current = handleDeskCheck;

    // ── Game handlers ───────────────────────────────────────
    const handleGameChoice = (choice) => {
        if (choice.isWin !== undefined || choice.result) {
            setGameEnding({
                isWin: choice.isWin || false,
                text: choice.result || (choice.isWin ? 'Ви виграли!' : 'Спробуйте ще!')
            });
        } else if (choice.nextNodeId) {
            setCurrentNodeId(choice.nextNodeId);
        }
    };

    // ── Quiz handlers ───────────────────────────────────────
    const handleQuizAnswer = (qIdx, aIdx) => {
        if (quizDone) return;
        setQuizAnswers(prev => ({ ...prev, [qIdx]: aIdx }));
    };

    const handleQuizSubmit = () => {
        const refData = step?.refData;
        if (!refData) return;
        let score = 0;
        refData.questions.forEach((q, idx) => {
            if (quizAnswers[idx] === q.correctIndex) score++;
        });
        const total = refData.questions.length;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= (refData.passingScore || 80);
        setQuizResult({ score, total, percentage, passed });
        setQuizDone(true);
    };

    // ── Next step ───────────────────────────────────────────
    const getStepResult = () => {
        if (step.type === 'desk' && deskResult) {
            return { type: 'desk', title: step.title, ...deskResult };
        }
        if (step.type === 'game' && gameEnding) {
            return { type: 'game', title: step.title, score: gameEnding.isWin ? 1 : 0, total: 1, percentage: gameEnding.isWin ? 100 : 0, passed: gameEnding.isWin };
        }
        if (step.type === 'quiz' && quizResult) {
            return { type: 'quiz', title: step.title, ...quizResult };
        }
        return null;
    };

    const canProceed = () => {
        if (step.type === 'desk') return !!deskResult;
        if (step.type === 'game') return !!gameEnding;
        if (step.type === 'quiz') return !!quizResult;
        return false;
    };

    const handleNext = async () => {
        const result = getStepResult();
        const newResults = [...stepResults, result];
        setStepResults(newResults);

        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            try {
                await axios.post(`${API_URL}/complex-tests/hash/${hash}/submit`, {
                    studentName: studentInfo.firstName,
                    studentLastName: studentInfo.lastName,
                    studentCity: studentInfo.city,
                    steps: newResults
                });
            } catch (e) { console.error('Submit error:', e); }
            setShowSummary(true);
        }
    };

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    // Registration
    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>🧩 {testData.title}</h2>
                    {testData.description && <p>{testData.description}</p>}
                    <p>Кроків: <strong>{steps.length}</strong></p>
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

    // Summary
    if (showSummary) {
        const totalScore = stepResults.reduce((s, r) => s + (r?.score || 0), 0);
        const totalMax = stepResults.reduce((s, r) => s + (r?.total || 0), 0);
        const overallPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
        const allPassed = stepResults.every(r => r?.passed);

        return (
            <div className="complex-play">
                <div className="complex-summary">
                    <h2>📋 Зведений результат</h2>
                    <table className="complex-summary-table">
                        <thead>
                            <tr><th>Крок</th><th>Тип</th><th>Бали</th><th>Статус</th></tr>
                        </thead>
                        <tbody>
                            {stepResults.map((r, i) => (
                                <tr key={i} className={r?.passed ? 'row-pass' : 'row-fail'}>
                                    <td>{r?.title || `#${i + 1}`}</td>
                                    <td>{r?.type === 'desk' ? '🖥️' : r?.type === 'game' ? '🎮' : '📝'}</td>
                                    <td>{r?.score}/{r?.total}</td>
                                    <td>{r?.passed ? '✅' : '❌'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="complex-overall">
                        <div className="complex-overall-score" style={{ color: allPassed ? '#4ade80' : '#f87171' }}>
                            {overallPercent}%
                        </div>
                        <p className="complex-overall-status">
                            {allPassed ? '✅ Всі кроки пройдено!' : '❌ Деякі кроки не пройдено'}
                        </p>
                    </div>
                    <button className="btn-save-template" onClick={() => window.location.reload()} style={{ width: '100%' }}>
                        Повторити
                    </button>
                </div>
            </div>
        );
    }

    // Step content
    const gameData = step?.refData;
    const currentNode = step?.type === 'game' && gameData
        ? gameData.nodes?.find(n => n.nodeId === currentNodeId) : null;
    const gameSpeaker = currentNode?.speakerId
        ? gameData.characters?.find(c => c.charId === currentNode.speakerId) : null;

    return (
        <div className="complex-play">
            {/* Stepper */}
            <div className="complex-stepper">
                {steps.map((s, i) => (
                    <div key={i} className="cs-step">
                        <div className={`cs-circle ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                            {i < currentStep ? '✓' : i + 1}
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`cs-line ${i < currentStep ? 'done' : ''}`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="complex-step-header">
                <h2>{step?.type === 'desk' ? '🖥️' : step?.type === 'game' ? '🎮' : '📝'} {step?.title}</h2>
                <p>{studentInfo.firstName} {studentInfo.lastName} · Крок {currentStep + 1} з {steps.length}</p>
            </div>

            <div className="complex-step-content">
                {/* ── DESK ── */}
                {step?.type === 'desk' && step.refData && (
                    <div className={`virtual-desk-container student-test ${deskResult ? 'has-result' : ''}`} style={{ flex: 1 }}>
                        <header className="desk-header">
                            <div className="header-info">
                                <p>На столі: {deskItems.length} предметів</p>
                            </div>
                            <div className="header-actions">
                                {timeLeft !== null && !deskResult && (
                                    <span className={`test-timer ${timeLeft < 60 ? 'timer-warning' : ''}`}
                                        style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                        ⏱ {formatTime(timeLeft)}
                                    </span>
                                )}
                                {!deskResult && (
                                    <button className="btn-add" onClick={handleDeskCheck} disabled={deskItems.length === 0}>
                                        Перевірити
                                    </button>
                                )}
                                {deskResult && (
                                    <button className="btn-save-template" onClick={handleNext}>
                                        {currentStep < steps.length - 1 ? 'Далі →' : 'Завершити'}
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
                                            onClick={() => !deskResult && setSelectedDish(dish)}>
                                            <span className="inv-icon">{dish.icon}</span>
                                            <span className="inv-name">{dish.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                            <div className="desk-workspace">
                                <div className="square-desk" onClick={handleDeskClick}>
                                    {deskResult && step.refData.items.map((target, idx) => (
                                        <div key={`g-${idx}`} className="desk-item ghost-item"
                                            style={{ left: `${(target.x / 500) * 100}%`, top: `${(target.y / 500) * 100}%` }}>
                                            <span className="item-icon">{target.icon}</span>
                                        </div>
                                    ))}
                                    {deskItems.map(item => (
                                        <div key={item._id}
                                            className={`desk-item ${deskResult ? (item.isCorrect ? 'correct' : 'incorrect') : ''}`}
                                            style={{ left: `${(item.x / 500) * 100}%`, top: `${(item.y / 500) * 100}%` }}
                                            onClick={e => e.stopPropagation()}>
                                            <span className="item-icon">{item.icon}</span>
                                            <span className="item-text">{item.name}</span>
                                            {!deskResult && (
                                                <button className="item-delete" onClick={() => handleDeleteDeskItem(item._id)}>×</button>
                                            )}
                                        </div>
                                    ))}
                                    {deskItems.length === 0 && !deskResult && (
                                        <div className="desk-placeholder">
                                            <span className="desk-icon">📋</span>
                                            <span className="desk-label">Розпочніть сервірування</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {deskResult && (
                                <aside className="desk-panel results-panel">
                                    <div className="panel-label">Результат</div>
                                    <div className="result-card">
                                        <div className="result-score" style={{ color: deskResult.passed ? '#4ade80' : '#f87171' }}>
                                            {deskResult.percentage}%
                                        </div>
                                        <p>Правильно: {deskResult.score} з {deskResult.total}</p>
                                        <p className="result-status">
                                            {deskResult.passed ? '✅ Пройдено!' : '❌ Не пройдено'}
                                        </p>
                                    </div>
                                </aside>
                            )}
                        </div>
                    </div>
                )}

                {/* ── GAME ── */}
                {step?.type === 'game' && step.refData && (
                    <div className="game-embed">
                        {!gameEnding && currentNode ? (
                            <div className="game-node">
                                {gameSpeaker && (
                                    <div className="game-speaker">
                                        <span className="game-speaker-avatar">{gameSpeaker.avatar || '🧑'}</span>
                                        <span className="game-speaker-name" style={{ color: gameSpeaker.color || '#38bdf8' }}>
                                            {gameSpeaker.name}
                                        </span>
                                    </div>
                                )}
                                <div className="game-text">{currentNode.text}</div>
                                <div className="game-choices">
                                    {currentNode.choices?.map((choice, ci) => (
                                        <button key={ci} className="game-choice-btn"
                                            onClick={() => handleGameChoice(choice)}>
                                            {choice.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : gameEnding ? (
                            <div className="game-node">
                                <div className="game-ending">
                                    <h3>{gameEnding.isWin ? '🎉 Перемога!' : '😔 Спробуйте ще'}</h3>
                                    <p>{gameEnding.text}</p>
                                    <button className="btn-save-template" onClick={handleNext}>
                                        {currentStep < steps.length - 1 ? 'Далі →' : 'Завершити'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="game-node">
                                <div className="game-ending">
                                    <p>Помилка завантаження гри</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── QUIZ ── */}
                {step?.type === 'quiz' && step.refData && (
                    <div className="quiz-embed">
                        {!quizDone ? (
                            <>
                                <div className="quiz-progress-bar">
                                    <div className="quiz-progress-fill"
                                        style={{ width: `${((currentQuestion + 1) / step.refData.questions.length) * 100}%` }} />
                                </div>
                                {step.refData.questions[currentQuestion] && (
                                    <div className="quiz-question-card">
                                        <div className="quiz-q-number">
                                            Питання {currentQuestion + 1} з {step.refData.questions.length}
                                        </div>
                                        <div className="quiz-q-text">{step.refData.questions[currentQuestion].text}</div>
                                        {step.refData.questions[currentQuestion].image && (
                                            <img className="quiz-q-image" src={step.refData.questions[currentQuestion].image} alt="question" />
                                        )}
                                        <div className="quiz-options">
                                            {step.refData.questions[currentQuestion].options.map((opt, oi) => (
                                                <button key={oi}
                                                    className={`quiz-option ${quizAnswers[currentQuestion] === oi ? 'selected' : ''}`}
                                                    onClick={() => handleQuizAnswer(currentQuestion, oi)}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="quiz-nav">
                                            {currentQuestion < step.refData.questions.length - 1 ? (
                                                <button className="btn-save-template"
                                                    disabled={quizAnswers[currentQuestion] === undefined}
                                                    onClick={() => setCurrentQuestion(q => q + 1)}>
                                                    Далі →
                                                </button>
                                            ) : (
                                                <button className="btn-save-template"
                                                    disabled={quizAnswers[currentQuestion] === undefined}
                                                    onClick={handleQuizSubmit}>
                                                    Перевірити
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="quiz-question-card" style={{ textAlign: 'center' }}>
                                <div className="result-score" style={{ color: quizResult.passed ? '#4ade80' : '#f87171' }}>
                                    {quizResult.percentage}%
                                </div>
                                <p>Правильно: {quizResult.score} з {quizResult.total}</p>
                                <p style={{ fontWeight: 600, marginBottom: '1.5rem' }}>
                                    {quizResult.passed ? '✅ Пройдено!' : '❌ Не пройдено'}
                                </p>
                                <button className="btn-save-template" onClick={handleNext}>
                                    {currentStep < steps.length - 1 ? 'Далі →' : 'Завершити'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Fallback next button */}
                {canProceed() && step?.type === 'desk' ? null : null}
            </div>
        </div>
    );
};

export default ComplexTestPlay;
