import React, { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import API_URL from '../api';
import './QuizEngine.css';

/**
 * Shared quiz engine — one question at a time, server-side answer checking.
 *
 * Props:
 *   questions     — array of { text, options, image?, video? } (NO correctIndex)
 *   checkAnswer   — async (questionIndex, answerIndex) => { isCorrect, correctIndex, explanation }
 *   onComplete    — (result) => void   where result = { score, total, percentage, passed, answers }
 *   passingScore  — number (default 80)
 *   timeLimit     — minutes (0 = no limit)
 *   title         — string (shown in header)
 *   embedded      — boolean (true when inside ComplexTestPlay, hides outer chrome)
 */
const QuizEngine = ({ questions, checkAnswer, onComplete, passingScore = 80, timeLimit = 0, title, embedded = false }) => {
    const [currentQ, setCurrentQ] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [checking, setChecking] = useState(false);
    const [answers, setAnswers] = useState([]); // { questionIndex, answerIndex, isCorrect, correctIndex, explanation }
    const [done, setDone] = useState(false);

    // Timer
    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        if (timeLimit > 0) {
            setTimeLeft(timeLimit * 60);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [timeLimit]);

    useEffect(() => {
        if (timeLeft === null || done) return;
        if (timeLeft <= 0) {
            // Auto-finish
            finishQuiz(answers);
            return;
        }
        timerRef.current = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft, done]);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const totalQ = questions.length;
    const q = questions[currentQ];

    const handleSelect = async (answerIndex) => {
        if (revealed || checking) return;
        setChecking(true);
        try {
            const res = await checkAnswer(currentQ, answerIndex);
            const entry = { questionIndex: currentQ, answerIndex, ...res };
            setAnswers(prev => [...prev, entry]);
            setRevealed(true);
        } catch (err) {
            console.error('Check answer error:', err);
        } finally {
            setChecking(false);
        }
    };

    const handleNext = () => {
        if (currentQ < totalQ - 1) {
            setRevealed(false);
            setCurrentQ(currentQ + 1);
        } else {
            finishQuiz([...answers]);
        }
    };

    const finishQuiz = (finalAnswers) => {
        if (done) return;
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const score = finalAnswers.filter(a => a.isCorrect).length;
        const total = totalQ;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= passingScore;

        // Build detailed answers for result storage
        const detailedAnswers = questions.map((q, idx) => {
            const a = finalAnswers.find(ans => ans.questionIndex === idx);
            return {
                questionText: q.text,
                image: q.image,
                video: q.video,
                givenAnswer: a ? q.options[a.answerIndex] || '—' : '—',
                correctAnswer: a ? q.options[a.correctIndex] || '?' : '?',
                explanation: a?.explanation || null,
                isCorrect: a?.isCorrect || false
            };
        });

        onCompleteRef.current({ score, total, percentage, passed, answers: detailedAnswers });
    };

    // Current answer data (if revealed)
    const currentAnswer = revealed ? answers.find(a => a.questionIndex === currentQ) : null;
    const selectedIdx = currentAnswer?.answerIndex;
    const correctIdx = currentAnswer?.correctIndex;

    const optionCls = (oi) => {
        if (!revealed) return 'qe-option';
        if (oi === correctIdx) return 'qe-option correct';
        if (oi === selectedIdx) return 'qe-option wrong';
        return 'qe-option dimmed';
    };

    if (done) return null; // parent handles result display

    return (
        <div className={`qe-root ${embedded ? 'embedded' : ''}`}>
            {/* Timer */}
            {timeLeft !== null && !done && (
                <div className={`qe-timer ${timeLeft < 60 ? 'warning' : ''}`}>
                    🕒 {formatTime(timeLeft)}
                </div>
            )}

            {!embedded && title && (
                <div className="qe-header">
                    <h2>{title}</h2>
                </div>
            )}

            <div className="qe-progress-wrap">
                <span className="qe-progress-label">Питання {currentQ + 1} з {totalQ}</span>
                <div className="qe-progress-bar">
                    <div className="qe-progress-fill"
                        style={{ width: `${((currentQ + (revealed ? 1 : 0)) / totalQ) * 100}%` }} />
                </div>
            </div>

            <div className="qe-card">
                <div className="qe-q-text"><strong>{currentQ + 1}.</strong> {q.text}</div>

                {q.image && (
                    <div className="qe-media">
                        <img src={q.image.startsWith('http') ? q.image : `${API_URL.replace('/api', '')}${q.image}`}
                            alt="" className="qe-q-image" />
                    </div>
                )}
                {q.video && (
                    <div className="qe-media video">
                        <VideoPlayer url={q.video} />
                    </div>
                )}

                <div className="qe-options">
                    {q.options.map((opt, oi) => (
                        <button key={oi} className={optionCls(oi)}
                            onClick={() => handleSelect(oi)}
                            disabled={revealed || checking}
                            style={revealed ? { cursor: 'default' } : {}}>
                            <span className="qe-option-text">{opt}</span>
                            {revealed && oi === correctIdx && <span className="qe-mark correct">✓</span>}
                            {revealed && oi === selectedIdx && oi !== correctIdx && <span className="qe-mark wrong">✗</span>}
                        </button>
                    ))}
                </div>

                {checking && <div className="qe-checking">Перевірка...</div>}

                {revealed && currentAnswer?.explanation && (
                    <div className="qe-explanation">💡 {currentAnswer.explanation}</div>
                )}

                {revealed && (
                    <div className="qe-nav">
                        <button className="qe-btn-next" onClick={handleNext}>
                            {currentQ < totalQ - 1 ? 'Далі →' : 'Завершити'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuizEngine;
