import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import API_URL from '../api';
import QuizEngine from './QuizEngine';
import './QuizBuilder.css';

const QuizPlay = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '', position: '' });
    const [result, setResult] = useState(null);
    const [pendingResult, setPendingResult] = useState(null);
    const [submitError, setSubmitError] = useState('');
    const [submittingResult, setSubmittingResult] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get(`${API_URL}/quiz/hash/${hash}`);
                setQuiz(res.data);
                if (res.data.city) {
                    setStudentInfo((prev) => ({ ...prev, city: res.data.city }));
                }
            } catch (err) {
                console.error('fetchQuiz:', err);
                if (err.response?.status === 410) navigate('/inactive');
            } finally {
                setLoading(false);
            }
        })();
    }, [hash, navigate]);

    const handleRegister = (event) => {
        event.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        }
    };

    const checkAnswer = async (questionIndex, answerIndex) => {
        const res = await axios.post(`${API_URL}/quiz/check-answer`, { hash, questionIndex, answerIndex });
        return res.data;
    };

    const submitQuizResult = async () => {
        setSubmittingResult(true);
        setSubmitError('');

        try {
            const res = await axios.post(`${API_URL}/quiz/hash/${hash}/submit`, {
                studentName: studentInfo.firstName,
                studentLastName: studentInfo.lastName,
                studentCity: studentInfo.city,
                studentPosition: studentInfo.position
            });
            setResult(res.data);
            setSubmitError('');
        } catch (err) {
            console.error('submit error:', err);
            setSubmitError(err.response?.data?.error || 'Результат не вдалося зберегти. Спробуйте ще раз.');
        } finally {
            setSubmittingResult(false);
        }
    };

    const handleQuizComplete = async (quizResult) => {
        setPendingResult(quizResult);
        await submitQuizResult();
    };

    const handleRetrySubmit = async () => {
        if (!pendingResult || submittingResult) return;
        await submitQuizResult();
    };

    if (loading) return <div className="placeholder-view">Завантаження...</div>;
    if (!quiz) return <div className="placeholder-view">Тест не знайдено</div>;

    if (!isRegistered) {
        return (
            <div className="registration-container" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="registration-card" style={{ background: '#1a1a1a', padding: '3rem', borderRadius: '2rem', border: '1px solid #333', width: '400px' }}>
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Реєстрація на тест</h2>
                    <p style={{ color: '#888', marginBottom: '1rem' }}>Квіз: <strong>{quiz.title}</strong></p>
                    {quiz.timeLimit > 0 && <p style={{ color: '#38bdf8', marginBottom: '2rem' }}>Час на проходження: {quiz.timeLimit} хв</p>}
                    <form onSubmit={handleRegister}>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Ім'я</label>
                            <input
                                className="qb-input"
                                value={studentInfo.firstName}
                                onChange={(event) => setStudentInfo({ ...studentInfo, firstName: event.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Прізвище</label>
                            <input
                                className="qb-input"
                                value={studentInfo.lastName}
                                onChange={(event) => setStudentInfo({ ...studentInfo, lastName: event.target.value })}
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
                                onChange={(event) => setStudentInfo({ ...studentInfo, position: event.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className="qb-btn qb-btn-primary" style={{ width: '100%' }}>Почати квіз</button>
                    </form>
                </div>
            </div>
        );
    }

    if (submittingResult && pendingResult && !result) {
        return (
            <div className="registration-container" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="registration-card" style={{ background: '#1a1a1a', padding: '3rem', borderRadius: '2rem', border: '1px solid #333', textAlign: 'center', maxWidth: '480px' }}>
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Зберігаємо результат...</h2>
                    <p style={{ color: '#888', marginBottom: '1rem' }}>Ваші відповіді вже перевірені. Зачекайте, поки система збереже результат.</p>
                    <p style={{ color: '#38bdf8', margin: 0 }}>Поточний результат: {pendingResult.percentage}%</p>
                </div>
            </div>
        );
    }

    if (submitError && pendingResult && !result) {
        const isPassed = pendingResult.percentage >= (quiz.passingScore || 80);
        return (
            <div className="registration-container" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="registration-card" style={{ background: '#1a1a1a', padding: '3rem', borderRadius: '2rem', border: '1px solid #333', textAlign: 'center', maxWidth: '520px' }}>
                    <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Результат не збережено</h2>
                    <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{submitError}</p>
                    <p style={{ color: isPassed ? '#10b981' : '#f59e0b', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                        Локальний результат: {pendingResult.percentage}%
                    </p>
                    <p style={{ color: '#888', marginBottom: '2rem' }}>
                        Ми не показуємо успішне завершення, поки сервер не підтвердить збереження.
                    </p>
                    <button type="button" className="qb-btn qb-btn-primary" onClick={handleRetrySubmit} disabled={submittingResult}>
                        Спробувати зберегти ще раз
                    </button>
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

    return (
        <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', padding: '2rem' }}>
            <QuizEngine
                key={`${hash}-${quiz.attemptProgress || 0}`}
                questions={quiz.questions}
                checkAnswer={checkAnswer}
                onComplete={handleQuizComplete}
                passingScore={quiz.passingScore || 80}
                timeLimit={quiz.timeLimit || 0}
                title={quiz.title}
                initialQuestionIndex={quiz.attemptProgress || 0}
                initialAnswers={quiz.attemptAnswers || []}
            />
        </div>
    );
};

export default QuizPlay;
