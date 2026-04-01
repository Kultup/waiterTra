import React, { useCallback, useEffect, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import './QuizEngine.css';
import { resolveAssetUrl } from '../utils/assetUrl';

const QuizEngine = ({
    questions,
    checkAnswer,
    onComplete,
    passingScore = 80,
    timeLimit = 0,
    title,
    embedded = false,
    initialQuestionIndex = 0,
    initialAnswers = []
}) => {
    const totalQ = questions.length;
    const [currentQ, setCurrentQ] = useState(() => Math.min(initialQuestionIndex, totalQ));
    const [revealed, setRevealed] = useState(false);
    const [checking, setChecking] = useState(false);
    const [answers, setAnswers] = useState(() => initialAnswers);
    const [done, setDone] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const finishQuiz = useCallback((finalAnswers) => {
        if (done) return;

        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const score = finalAnswers.filter((answer) => answer.isCorrect).length;
        const total = totalQ;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= passingScore;

        const detailedAnswers = questions.map((question, index) => {
            const answer = finalAnswers.find((entry) => entry.questionIndex === index);
            const givenAnswer = answer && Number.isInteger(answer.answerIndex)
                ? question.options[answer.answerIndex] || '—'
                : '—';
            const correctAnswer = answer && Number.isInteger(answer.correctIndex)
                ? question.options[answer.correctIndex] || '?'
                : (answer?.isCorrect ? givenAnswer : '?');

            return {
                questionText: question.text,
                image: question.image,
                video: question.video,
                givenAnswer,
                correctAnswer,
                explanation: answer?.explanation || null,
                isCorrect: answer?.isCorrect || false
            };
        });

        onCompleteRef.current({ score, total, percentage, passed, answers: detailedAnswers });
    }, [done, passingScore, questions, totalQ]);

    useEffect(() => {
        if (timeLimit > 0) {
            setTimeLeft(timeLimit * 60);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timeLimit]);

    useEffect(() => {
        if (timeLeft === null || done) return undefined;
        if (timeLeft <= 0) {
            finishQuiz(answers);
            return undefined;
        }

        timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [answers, done, finishQuiz, timeLeft]);

    useEffect(() => {
        if (!done && totalQ > 0 && currentQ >= totalQ) {
            finishQuiz(answers);
        }
    }, [answers, currentQ, done, finishQuiz, totalQ]);

    const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

    const q = questions[currentQ];

    const handleSelect = async (answerIndex) => {
        if (revealed || checking) return;

        setChecking(true);
        try {
            const response = await checkAnswer(currentQ, answerIndex);
            const entry = { questionIndex: currentQ, answerIndex, ...response };
            setAnswers((prev) => {
                const existingIndex = prev.findIndex((answer) => answer.questionIndex === currentQ);
                if (existingIndex === -1) return [...prev, entry];

                const next = [...prev];
                next[existingIndex] = { ...next[existingIndex], ...entry };
                return next;
            });
            setRevealed(true);
        } catch (error) {
            console.error('Check answer error:', error);
        } finally {
            setChecking(false);
        }
    };

    const handleNext = () => {
        if (currentQ < totalQ - 1) {
            setRevealed(false);
            setCurrentQ((prev) => prev + 1);
            return;
        }

        finishQuiz([...answers]);
    };

    const currentAnswer = revealed ? answers.find((answer) => answer.questionIndex === currentQ) : null;
    const selectedIdx = currentAnswer?.answerIndex;
    const correctIdx = currentAnswer?.correctIndex;

    const optionCls = (optionIndex) => {
        if (!revealed) return 'qe-option';
        if (Number.isInteger(correctIdx)) {
            if (optionIndex === correctIdx) return 'qe-option correct';
            if (optionIndex === selectedIdx) return 'qe-option wrong';
            return 'qe-option dimmed';
        }
        if (optionIndex === selectedIdx) {
            return `qe-option ${currentAnswer?.isCorrect ? 'correct' : 'wrong'}`;
        }
        return 'qe-option dimmed';
    };

    const renderOptionMark = (optionIndex) => {
        if (!revealed || optionIndex !== selectedIdx) return null;
        if (Number.isInteger(correctIdx)) {
            return optionIndex !== correctIdx ? <span className="qe-mark wrong">✕</span> : null;
        }
        return currentAnswer?.isCorrect
            ? <span className="qe-mark correct">✓</span>
            : <span className="qe-mark wrong">✕</span>;
    };

    if (done) return null;
    if (!q) return null;

    return (
        <div className={`qe-root ${embedded ? 'embedded' : ''}`}>
            {timeLeft !== null && !done && (
                <div className={`qe-timer ${timeLeft < 60 ? 'warning' : ''}`}>
                    ⏲ {formatTime(timeLeft)}
                </div>
            )}

            {!embedded && title && (
                <div className="qe-header">
                    <h2>{title}</h2>
                </div>
            )}

            <div className="qe-progress-wrap">
                <span className="qe-progress-label">Питання {Math.min(currentQ + 1, totalQ)} з {totalQ}</span>
                <div className="qe-progress-bar">
                    <div
                        className="qe-progress-fill"
                        style={{ width: `${totalQ > 0 ? ((currentQ + (revealed ? 1 : 0)) / totalQ) * 100 : 0}%` }}
                    />
                </div>
            </div>

            <div className="qe-card">
                <div className="qe-q-text"><strong>{currentQ + 1}.</strong> {q.text}</div>

                {q.image && (
                    <div className="qe-media">
                        <img src={resolveAssetUrl(q.image)} alt="" className="qe-q-image" />
                    </div>
                )}
                {q.video && (
                    <div className="qe-media video">
                        <VideoPlayer url={q.video} />
                    </div>
                )}

                <div className="qe-options">
                    {q.options.map((option, optionIndex) => (
                        <button
                            key={optionIndex}
                            className={optionCls(optionIndex)}
                            onClick={() => handleSelect(optionIndex)}
                            disabled={revealed || checking}
                            style={revealed ? { cursor: 'default' } : {}}
                        >
                            <span className="qe-option-text">{option}</span>
                            {revealed && Number.isInteger(correctIdx) && optionIndex === correctIdx && <span className="qe-mark correct">✓</span>}
                            {renderOptionMark(optionIndex)}
                        </button>
                    ))}
                </div>

                {checking && <div className="qe-checking">Перевірка...</div>}

                {revealed && currentAnswer?.explanation && (
                    <div className="qe-explanation">Підказка: {currentAnswer.explanation}</div>
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
