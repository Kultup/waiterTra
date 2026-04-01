import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './VirtualDesk.css';
import './ComplexTestPlay.css';
import API_URL from '../api';
import DeskEngine from './DeskEngine';
import QuizEngine from './QuizEngine';

const ComplexTestPlay = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [testData, setTestData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '', position: '' });

    const [currentStep, setCurrentStep] = useState(0);
    const [stepResults, setStepResults] = useState([]);
    const [showSummary, setShowSummary] = useState(false);

    // Per-step completion flag (set by engines via callbacks)
    const [stepDone, setStepDone] = useState(false);
    const [currentStepResult, setCurrentStepResult] = useState(null);

    // Game state (no shared engine — stays inline)
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [gameEnding, setGameEnding] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const testRes = await axios.get(`${API_URL}/complex-tests/hash/${hash}`);
                setTestData(testRes.data);
                if (testRes.data.city) {
                    setStudentInfo(prev => ({ ...prev, city: testRes.data.city }));
                }
            } catch (err) {
                console.error('Error fetching complex test data:', err);
                if (err.response?.status === 410) navigate('/inactive');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [hash, navigate]);

    const steps = testData?.steps || [];
    const step = steps[currentStep];
    const deskStepDishes = step?.type === 'desk'
        ? (step.refData?.allowedItems || []).map((item) => ({
            ...item,
            _id: item.id || item.type,
            id: item.id || item.type,
        }))
        : [];

    // Reset per-step state when step changes
    useEffect(() => {
        if (!step) return;
        setStepDone(false);
        setCurrentStepResult(null);
        setCurrentNodeId(null);
        setGameEnding(null);

        if (step.type === 'game' && step.refData) {
            setCurrentNodeId(step.refData.startNodeId);
        }
    }, [currentStep, step]);

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    // ── Desk: server-side scoring via /check-desk-step ──
    const handleDeskSubmit = async (items) => {
        const res = await axios.post(`${API_URL}/complex-tests/check-desk-step`, {
            hash, stepIndex: currentStep, items
        });
        const { score, total, percentage, passed, validatedItems, ghostItems } = res.data;
        return { score, total, percentage, passed, validatedItems, ghostItems };
    };

    const handleDeskResult = (result) => {
        setCurrentStepResult({ type: 'desk', title: step.title, ...result });
        setStepDone(true);
    };

    // ── Quiz: server-side per-question checking ──
    const checkQuizAnswer = async (questionIndex, answerIndex) => {
        const res = await axios.post(`${API_URL}/complex-tests/check-quiz-answer`, {
            hash, stepIndex: currentStep, questionIndex, answerIndex
        });
        return res.data;
    };

    const handleQuizComplete = (quizResult) => {
        setCurrentStepResult({ type: 'quiz', title: step.title, ...quizResult });
        setStepDone(true);
    };

    // ── Game handlers (inline) ──
    const handleGameChoice = (choice) => {
        if (choice.isWin || choice.result) {
            const isWin = choice.isWin || false;
            setGameEnding({
                isWin,
                text: choice.result || (isWin ? 'Ви виграли!' : 'Спробуйте ще!')
            });
            setCurrentStepResult({
                type: 'game', title: step.title,
                score: isWin ? 1 : 0, total: 1,
                percentage: isWin ? 100 : 0, passed: isWin
            });
            setStepDone(true);
        } else if (choice.nextNodeId) {
            setCurrentNodeId(choice.nextNodeId);
        }
    };

    // ── Next step / finish ──
    const handleNext = async () => {
        if (!currentStepResult) return;
        const newResults = [...stepResults, currentStepResult];
        setStepResults(newResults);

        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            try {
                await axios.post(`${API_URL}/complex-tests/hash/${hash}/submit`, {
                    studentName: studentInfo.firstName,
                    studentLastName: studentInfo.lastName,
                    studentCity: studentInfo.city,
                    studentPosition: studentInfo.position,
                    steps: newResults
                });
            } catch (e) { console.error('Submit error:', e); }
            setShowSummary(true);
        }
    };

    const nextLabel = currentStep < steps.length - 1 ? 'Далі \u2192' : 'Завершити';
    const nextButton = (
        <button className="btn-save-template" onClick={handleNext}>{nextLabel}</button>
    );

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    // Registration
    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>{testData.title}</h2>
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
                            <input type="text" value={studentInfo.city || '—'} disabled
                                style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '1rem', opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                        <div className="form-group">
                            <label>Посада</label>
                            <input type="text" value={studentInfo.position}
                                onChange={e => setStudentInfo({ ...studentInfo, position: e.target.value })}
                                placeholder="Введіть посаду" required />
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
                    <h2>Зведений результат</h2>
                    <table className="complex-summary-table">
                        <thead>
                            <tr><th>Крок</th><th>Тип</th><th>Бали</th><th>Статус</th></tr>
                        </thead>
                        <tbody>
                            {stepResults.map((r, i) => (
                                <tr key={i} className={r?.passed ? 'row-pass' : 'row-fail'}>
                                    <td>{r?.title || `#${i + 1}`}</td>
                                    <td>{r?.type === 'desk' ? 'Сервірування' : r?.type === 'game' ? 'Гра' : 'Квіз'}</td>
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
                </div>
            </div>
        );
    }

    // Game data
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
                <p>{studentInfo.firstName} {studentInfo.lastName} · {studentInfo.city} ({studentInfo.position}) · Крок {currentStep + 1} з {steps.length}</p>
            </div>

            <div className="complex-step-content">
                {/* ── DESK ── */}
                {step?.type === 'desk' && step.refData && (
                    <DeskEngine
                        key={`desk-${currentStep}`}
                        dishes={deskStepDishes}
                        description={step.refData.description}
                        timeLimit={step.timeLimit || step.refData?.timeLimit || 0}
                        onSubmit={handleDeskSubmit}
                        onResult={handleDeskResult}
                        embedded
                        nextButton={nextButton}
                    />
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
                                    {nextButton}
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
                {step?.type === 'quiz' && step.refData && !stepDone && (
                    <div className="quiz-embed">
                        <QuizEngine
                            key={`quiz-${currentStep}`}
                            questions={step.refData.questions}
                            checkAnswer={checkQuizAnswer}
                            onComplete={handleQuizComplete}
                            passingScore={step.refData.passingScore || 80}
                            timeLimit={step.refData.timeLimit || 0}
                            title={step.title}
                            embedded
                            initialQuestionIndex={step.refData.attemptProgress || 0}
                            initialAnswers={step.refData.attemptAnswers || []}
                        />
                    </div>
                )}

                {/* Quiz result (shown after QuizEngine returns null) */}
                {step?.type === 'quiz' && stepDone && currentStepResult && (
                    <div className="quiz-embed">
                        <div className="quiz-question-card" style={{ textAlign: 'center' }}>
                            <div className="result-score" style={{ color: currentStepResult.passed ? '#4ade80' : '#f87171' }}>
                                {currentStepResult.percentage}%
                            </div>
                            <p>Правильно: {currentStepResult.score} з {currentStepResult.total}</p>
                            <p style={{ fontWeight: 600, marginBottom: '1.5rem' }}>
                                {currentStepResult.passed ? '✅ Пройдено!' : '❌ Не пройдено'}
                            </p>
                            {nextButton}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplexTestPlay;
