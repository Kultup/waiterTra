import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import API_URL from '../api';
import ConfirmModal from './ConfirmModal';
import './QuizBuilder.css'; // Reusing some base styles

const VideoPlayer = ({ url }) => {
    if (!url) return null;

    // Detect YouTube
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
    if (ytMatch && ytMatch[1]) {
        const videoId = ytMatch[1].split('&')[0];
        return (
            <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            ></iframe>
        );
    }

    // Detect Vimeo
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
        return (
            <iframe
                src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
            ></iframe>
        );
    }

    // Generic HTML5 Video
    const videoSrc = url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
    return (
        <video controls style={{ width: '100%', height: '100%' }}>
            <source src={videoSrc} />
            Your browser does not support the video tag.
        </video>
    );
};

const QuizPlay = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '', position: '' });
    const [answers, setAnswers] = useState({});
    const [currentQ, setCurrentQ] = useState(0);
    const [revealed, setRevealed] = useState(false); // answer feedback shown
    const [result, setResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false });

    // Timer state
    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);

    useEffect(() => {
        fetchQuiz();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [hash]);

    const fetchQuiz = async () => {
        try {
            const res = await axios.get(`${API_URL}/quiz/hash/${hash}`);
            setQuiz(res.data);
            if (res.data.city) {
                setStudentInfo(prev => ({ ...prev, city: res.data.city }));
            }
        } catch (err) {
            console.error('fetchQuiz:', err);
            if (err.response?.status === 410) {
                navigate('/inactive');
            }
        } finally {
            setLoading(false);
        }
    };


    const startTimer = (mins) => {
        if (!mins || mins <= 0) return;
        setTimeLeft(mins * 60);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmit(true); // Auto-submit when time is up
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleRegister = (e) => {
        e.preventDefault();
        // Validation now exclude explicit city selection, but check if we have it from info
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
            if (quiz && quiz.timeLimit > 0) {
                startTimer(quiz.timeLimit);
            }
        }
    };

    const processSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            const res = await axios.post(`${API_URL}/quiz/hash/${hash}/submit`, {
                studentName: studentInfo.firstName,
                studentLastName: studentInfo.lastName,
                studentCity: studentInfo.city,
                studentPosition: studentInfo.position,
                answers
            });
            setResult(res.data);
        } catch (err) {
            console.error('submit error:', err);
            alert('Помилка при відправці');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (isAuto = false) => {
        if (!isAuto && Object.keys(answers).length < quiz.questions.length) {
            setConfirmModal({ isOpen: true });
            return;
        }
        await processSubmit();
    };

    const handleConfirmSubmit = () => {
        setConfirmModal({ isOpen: false });
        processSubmit();
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) return <div className="placeholder-view">Завантаження...</div>;
    if (!quiz) return <div className="placeholder-view">Тест не знайдено</div>;

    if (!isRegistered) {
        return (
            <div className="registration-container" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="registration-card" style={{ background: '#1a1a1a', padding: '3rem', borderRadius: '2rem', border: '1px solid #333', width: '400px' }}>
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Реєстрація на тест</h2>
                    <p style={{ color: '#888', marginBottom: '1rem' }}>Квіз: <strong>{quiz.title}</strong></p>
                    {quiz.timeLimit > 0 && <p style={{ color: '#38bdf8', marginBottom: '2rem' }}>🕒 Час на проходження: {quiz.timeLimit} хв</p>}
                    <form onSubmit={handleRegister}>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Ім'я</label>
                            <input
                                className="qb-input"
                                value={studentInfo.firstName}
                                onChange={e => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Прізвище</label>
                            <input
                                className="qb-input"
                                value={studentInfo.lastName}
                                onChange={e => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Місто</label>
                            <input
                                className="qb-input"
                                value={studentInfo.city || '—'}
                                disabled
                                style={{ opacity: 0.7, cursor: 'not-allowed' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="qb-label">Посада</label>
                            <input
                                className="qb-input"
                                value={studentInfo.position}
                                onChange={e => setStudentInfo({ ...studentInfo, position: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className="qb-btn qb-btn-primary" style={{ width: '100%' }}>Почати квіз</button>
                    </form>
                </div>
            </div>
        );
    }

    if (result) {
        const isPassed = result.percentage >= (quiz.passingScore || 80);
        return (
            <div className="registration-container" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="registration-card" style={{ background: '#1a1a1a', padding: '3rem', borderRadius: '2rem', border: '1px solid #333', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{isPassed ? '🎉' : '📝'}</div>
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Результат: {result.percentage}%</h2>
                    <p style={{ color: isPassed ? '#10b981' : '#ef4444', fontWeight: 'bold', marginBottom: '1rem' }}>
                        {isPassed ? 'ТЕСТ ПРОЙДЕНО' : 'ТЕСТ НЕ ЗДАНО'}
                    </p>
                    <p style={{ color: '#888', marginBottom: '2rem' }}>Ви відповіли правильно на {result.score} з {result.total} питань.</p>
                </div>
            </div>
        );
    }

    const q = quiz.questions[currentQ];
    const totalQ = quiz.questions.length;
    const isLast = currentQ === totalQ - 1;
    const selectedIdx = answers[currentQ];
    const correctIdx = q.correctIndex;

    const handleSelectOption = (oIdx) => {
        if (revealed) return;
        setAnswers({ ...answers, [currentQ]: oIdx });
        setRevealed(true);
    };

    const handleNext = async () => {
        setRevealed(false);
        if (isLast) {
            await processSubmit();
        } else {
            setCurrentQ(currentQ + 1);
        }
    };

    const optionStyle = (oIdx) => {
        if (!revealed) {
            return {
                cursor: 'pointer',
                border: '1px solid #333',
                background: '#222'
            };
        }
        const isCorrect = oIdx === correctIdx;
        const isSelected = oIdx === selectedIdx;
        if (isCorrect) {
            return {
                cursor: 'default',
                border: '1px solid #10b981',
                background: 'rgba(16, 185, 129, 0.15)'
            };
        }
        if (isSelected && !isCorrect) {
            return {
                cursor: 'default',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.15)'
            };
        }
        return { cursor: 'default', border: '1px solid #333', background: '#222', opacity: 0.5 };
    };

    const radioDot = (oIdx) => {
        if (!revealed) return { border: '2px solid #555', background: 'transparent' };
        const isCorrect = oIdx === correctIdx;
        const isSelected = oIdx === selectedIdx;
        if (isCorrect) return { border: '2px solid #10b981', background: '#10b981' };
        if (isSelected) return { border: '2px solid #ef4444', background: '#ef4444' };
        return { border: '2px solid #555', background: 'transparent' };
    };

    return (
        <div className="student-quiz-view" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', padding: '2rem' }}>
            {timeLeft !== null && (
                <div className="timer-badge" style={{
                    position: 'fixed',
                    top: '2rem',
                    right: '2rem',
                    background: timeLeft < 60 ? '#ef4444' : '#333',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '1rem',
                    fontWeight: 'bold',
                    fontSize: '1.25rem',
                    border: '1px solid #444',
                    zIndex: 1000
                }}>
                    🕒 {formatTime(timeLeft)}
                </div>
            )}

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1.5rem' }}>
                    <h1>{quiz.title}</h1>
                    <p style={{ color: '#888', marginBottom: '0.75rem' }}>Питання {currentQ + 1} з {totalQ}</p>
                    <div className="quiz-progress-bar" style={{ height: '4px', background: '#333', borderRadius: '2px' }}>
                        <div className="quiz-progress-fill" style={{
                            height: '100%',
                            background: '#38bdf8',
                            borderRadius: '2px',
                            width: `${((currentQ + (revealed ? 1 : 0)) / totalQ) * 100}%`,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </header>

                <main>
                    <div className="qb-question-card" style={{ marginBottom: '2rem' }}>
                        <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}><strong>{currentQ + 1}.</strong> {q.text}</p>

                        {q.image && (
                            <div className="q-image-container" style={{ marginBottom: '1.5rem', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #333', textAlign: 'center' }}>
                                <img src={q.image.startsWith('http') ? q.image : `${API_URL.replace('/api', '')}${q.image}`} alt="Question" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                            </div>
                        )}

                        {q.video && (
                            <div className="q-video-container" style={{ marginBottom: '1.5rem', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #333', aspectRatio: '16/9' }}>
                                <VideoPlayer url={q.video} />
                            </div>
                        )}

                        <div className="qb-options-grid">
                            {q.options.map((opt, oIdx) => (
                                <div
                                    key={oIdx}
                                    className="qb-option-item"
                                    onClick={() => handleSelectOption(oIdx)}
                                    style={optionStyle(oIdx)}
                                >
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        ...radioDot(oIdx)
                                    }}>
                                        {(revealed && (oIdx === correctIdx || oIdx === selectedIdx)) && (
                                            <div style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%' }} />
                                        )}
                                    </div>
                                    <span>{opt}</span>
                                    {revealed && oIdx === correctIdx && <span style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 600 }}>✓</span>}
                                    {revealed && oIdx === selectedIdx && oIdx !== correctIdx && <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 600 }}>✗</span>}
                                </div>
                            ))}
                        </div>

                        {revealed && q.explanation && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '0.75rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                                💡 {q.explanation}
                            </div>
                        )}
                    </div>

                    {revealed && (
                        <button
                            className="qb-btn qb-btn-primary"
                            style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem' }}
                            onClick={handleNext}
                            disabled={submitting}
                        >
                            {submitting ? 'Відправка...' : isLast ? 'Завершити тест' : 'Далі →'}
                        </button>
                    )}
                </main>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Неповні відповіді"
                message="Ви відповіли не на всі питання. Продовжити завершення тесту?"
                confirmText="Так, завершити"
                onConfirm={handleConfirmSubmit}
                onCancel={() => setConfirmModal({ isOpen: false })}
            />
        </div>
    );
};

export default QuizPlay;
