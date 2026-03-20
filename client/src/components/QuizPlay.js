import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
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

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get(`${API_URL}/quiz/hash/${hash}`);
                setQuiz(res.data);
                if (res.data.city) {
                    setStudentInfo(prev => ({ ...prev, city: res.data.city }));
                }
            } catch (err) {
                console.error('fetchQuiz:', err);
                if (err.response?.status === 410) navigate('/inactive');
            } finally {
                setLoading(false);
            }
        })();
    }, [hash]);

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        }
    };

    const checkAnswer = async (questionIndex, answerIndex) => {
        const res = await axios.post(`${API_URL}/quiz/check-answer`, { hash, questionIndex, answerIndex });
        return res.data;
    };

    const handleQuizComplete = async (quizResult) => {
        // Submit final results to server
        try {
            // Build answers map (questionIndex → answerIndex) for the submit endpoint
            const answersMap = {};
            quizResult.answers.forEach((a, idx) => {
                const selectedOpt = a.givenAnswer;
                const optIdx = quiz.questions[idx].options.indexOf(selectedOpt);
                answersMap[idx] = optIdx >= 0 ? optIdx : undefined;
            });

            const res = await axios.post(`${API_URL}/quiz/hash/${hash}/submit`, {
                studentName: studentInfo.firstName,
                studentLastName: studentInfo.lastName,
                studentCity: studentInfo.city,
                studentPosition: studentInfo.position,
                answers: answersMap
            });
            setResult(res.data);
        } catch (err) {
            console.error('submit error:', err);
            // Use client-side result as fallback
            setResult(quizResult);
        }
    };

    if (loading) return <div className="placeholder-view">Завантаження...</div>;
    if (!quiz) return <div className="placeholder-view">Тест не знайдено</div>;

    // Registration
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
                            <input className="qb-input" value={studentInfo.firstName}
                                onChange={e => setStudentInfo({ ...studentInfo, firstName: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Прізвище</label>
                            <input className="qb-input" value={studentInfo.lastName}
                                onChange={e => setStudentInfo({ ...studentInfo, lastName: e.target.value })} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="qb-label">Місто</label>
                            <input className="qb-input" value={studentInfo.city || '—'} disabled
                                style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="qb-label">Посада</label>
                            <input className="qb-input" value={studentInfo.position}
                                onChange={e => setStudentInfo({ ...studentInfo, position: e.target.value })} required />
                        </div>
                        <button type="submit" className="qb-btn qb-btn-primary" style={{ width: '100%' }}>Почати квіз</button>
                    </form>
                </div>
            </div>
        );
    }

    // Result
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

    // Quiz in progress
    return (
        <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', padding: '2rem' }}>
            <QuizEngine
                questions={quiz.questions}
                checkAnswer={checkAnswer}
                onComplete={handleQuizComplete}
                passingScore={quiz.passingScore || 80}
                timeLimit={quiz.timeLimit || 0}
                title={quiz.title}
            />
        </div>
    );
};

export default QuizPlay;
