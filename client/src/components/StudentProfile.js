import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../api';
import './StudentProfile.css';
import { resolveAssetUrl } from '../utils/assetUrl';

const TYPE_LABELS = {
    desk: 'Стіл',
    game: 'Гра',
    quiz: 'Квіз',
    complex: 'Комплекс'
};

// --- Sub-components for details ---

const MetaField = ({ label, value, span }) => (
    <div className="sp-meta-field" style={span ? { gridColumn: `span ${span}` } : {}}>
        <span className="sp-meta-label">{label}</span>
        <span className="sp-meta-value">{value}</span>
    </div>
);

const ScoreBlock = ({ score, sub, passed, label }) => (
    <div className={`sp-score-block ${passed ? 'pass' : 'fail'}`}>
        <div className="sp-score-big">{score}</div>
        {sub && <div className="sp-score-sub">{sub}</div>}
        <span className={`sp-pill ${passed ? 'pass' : 'fail'}`}>{label}</span>
    </div>
);

const ErrorSection = ({ label, children }) => (
    <div className="sp-section">
        {label && <div className="sp-section-label">{label}</div>}
        {children}
    </div>
);

const ErrorGroup = ({ label, children }) => (
    <div className="sp-error-group">
        <div className="sp-error-group-label">{label}</div>
        {children}
    </div>
);

const ErrorItem = ({ icon, name, hint, type }) => (
    <div className={`sp-error-item ${type}`}>
        <span>{icon || '🍽️'} {name}</span>
        <span className="sp-error-hint">{hint}</span>
    </div>
);

const VideoPlayerMini = ({ url }) => {
    if (!url) return null;
    const ytMatch = url.match(/(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&]+)/);
    if (ytMatch) return <iframe title="yt" width="100%" height="300px"
        src={`https://www.youtube.com/embed/${ytMatch[1]}`} frameBorder="0" allowFullScreen />;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return <iframe title="vimeo"
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} width="100%" height="300px" frameBorder="0" allowFullScreen />;
    const src = resolveAssetUrl(url);
    return <video controls style={{ width: '100%', maxHeight: '300px' }}><source src={src} /></video>;
};

const QuizAnswersList = ({ answers }) => (
    <ErrorSection label="🔍 Аналіз відповідей">
        {answers.map((a, i) => (
            <div key={i} className={`sp-answer ${a.isCorrect ? 'correct' : 'wrong'}`}>
                <div className="sp-answer-q">Питання {i + 1}: {a.questionText}</div>
                {a.image && <img src={resolveAssetUrl(a.image)} alt="" className="sp-answer-img" />}
                {a.video && <div className="sp-answer-video"><VideoPlayerMini url={a.video} /></div>}
                <div className="sp-answer-row">
                    <span className={`sp-answer-badge ${a.isCorrect ? 'correct' : 'wrong'}`}>
                        {a.isCorrect ? '✅' : '❌'} {a.givenAnswer}
                    </span>
                    {!a.isCorrect && (
                        <div className="sp-answer-correction">
                            <span className="sp-answer-correct">✓ {a.correctAnswer}</span>
                            {a.explanation && <div className="sp-answer-explain">{a.explanation}</div>}
                        </div>
                    )}
                </div>
            </div>
        ))}
    </ErrorSection>
);

const DetailModal = ({ show, onClose, children, title }) => {
    if (!show) return null;
    return (
        <div className="sp-modal-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-modal-header">
                    <span className="sp-modal-title">{title}</span>
                    <button className="sp-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="sp-modal-body">{children}</div>
            </div>
        </div>
    );
};

const StudentProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);

    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_URL}/students/${id}`, config);
                setData(res.data);
            } catch (err) {
                console.error('Error fetching profile:', err);
                alert('Помилка завантаження профілю');
                navigate('/students');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id]);

    if (loading) return <div className="sp-loading">Вавантаження профілю...</div>;
    if (!data) return null;

    const { student, history } = data;

    return (
        <div className="student-profile">
            <div className="sp-header">
                <button className="btn-back" onClick={() => navigate('/students')}>
                    ← Назад до списку
                </button>
            </div>

            <div className="sp-info-card">
                <div className="sp-main-info">
                    <div className="sp-large-avatar">{student.studentLastName[0]}{student.studentName[0]}</div>
                    <div className="sp-name-box">
                        <h2>{student.studentLastName} {student.studentName}</h2>
                        <span className="sp-city-badge">🏙️ {student.studentCity || 'Місто не вказано'}</span>
                    </div>
                </div>
                <div className="sp-stats-grid">
                    <div className="sp-stat">
                        <span className="sp-stat-label">Середній бал</span>
                        <span className="sp-stat-value" style={{ color: student.avgScore >= 80 ? '#4ade80' : '#fbbf24' }}>
                            {student.avgScore}%
                        </span>
                    </div>
                    <div className="sp-stat">
                        <span className="sp-stat-label">Пройдено тестів</span>
                        <span className="sp-stat-value">{student.totalTests}</span>
                    </div>
                    <div className="sp-stat">
                        <span className="sp-stat-label">Остання активність</span>
                        <span className="sp-stat-date">{new Date(student.lastActivity).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            <div className="sp-history-section">
                <h3>📜 Історія проходжень</h3>
                <div className="sp-timeline">
                    {history.map((item, idx) => (
                        <div key={idx} className="sp-history-item">
                            <div className="sp-item-date">
                                <span className="sp-date-day">{new Date(item.completedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
                                <span className="sp-date-time">{new Date(item.completedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="sp-item-dot"></div>
                            <div className="sp-item-content clickable" onClick={() => setSelectedItem(item)}>
                                <div className="sp-item-header">
                                    <span className={`sp-type-badge sp-type-${item.type}`}>
                                        {TYPE_LABELS[item.type]}
                                    </span>
                                    <span className="sp-template-name">
                                        {item.templateName || item.scenarioTitle || item.quizId?.title || item.complexTestId?.title || 'Назва невідома'}
                                    </span>
                                </div>
                                <div className="sp-item-result">
                                    <div className="sp-progress-mini">
                                        <div className="sp-progress-fill" style={{ 
                                            width: `${item.percentage || (item.score / item.total * 100) || 0}%`,
                                            backgroundColor: item.passed || item.isWin ? '#4ade80' : '#f87171'
                                        }}></div>
                                    </div>
                                    <span className="sp-score-text">
                                        {item.score}/{item.total} ({item.percentage || Math.round(item.score / item.total * 100)}%)
                                    </span>
                                    <span className={`sp-status-icon ${item.passed || item.isWin ? 'success' : 'fail'}`}>
                                        {item.passed || item.isWin ? '✓' : '✗'}
                                    </span>
                                </div>
                                <div className="sp-item-footer">
                                    <span className="sp-view-detail">Переглянути деталі →</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <div className="sp-empty">Історія порожня</div>}
                </div>
            </div>

            <DetailModal 
                show={!!selectedItem} 
                onClose={() => setSelectedItem(null)}
                title={selectedItem ? `${TYPE_LABELS[selectedItem.type]}: ${selectedItem.templateName || selectedItem.scenarioTitle || selectedItem.quizId?.title || selectedItem.complexTestId?.title || ''}` : ''}
            >
                {selectedItem && (
                    <div className="sp-detail-view">
                        <div className="sp-detail-meta">
                            <MetaField label="Дата" value={new Date(selectedItem.completedAt).toLocaleString()} />
                            <MetaField label="Результат" value={`${selectedItem.score} / ${selectedItem.total}`} />
                            <MetaField label="Відсоток" value={`${selectedItem.percentage || Math.round(selectedItem.score / selectedItem.total * 100)}%`} />
                        </div>

                        {selectedItem.type === 'desk' && (
                            <div className="sp-desk-details">
                                <ScoreBlock 
                                    score={`${selectedItem.percentage}%`} 
                                    passed={selectedItem.passed} 
                                    label={selectedItem.passed ? 'Успішно' : 'Не здано'} 
                                />
                                {(selectedItem.userItems?.filter(i => !i.isCorrect).length > 0) && (
                                    <ErrorGroup label="Помилки">
                                        {selectedItem.userItems.filter(i => !i.isCorrect).map((it, i) => (
                                            <ErrorItem key={i} icon={it.icon} name={it.name || it.type} type="wrong" hint={`Неправильна позиція`} />
                                        ))}
                                    </ErrorGroup>
                                )}
                            </div>
                        )}

                        {selectedItem.type === 'game' && (
                            <div className="sp-game-details">
                                <ScoreBlock score={selectedItem.isWin ? '🎉' : '😔'} passed={selectedItem.isWin} label={selectedItem.isWin ? 'Перемога' : 'Поразка'} />
                                {selectedItem.choicePath?.length > 0 && (
                                    <div className="sp-path-list">
                                        {selectedItem.choicePath.map((cp, i) => (
                                            <div key={i} className="sp-path-step">
                                                <strong>{i + 1}.</strong> {cp.nodeText} → <em>{cp.choiceText}</em>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedItem.type === 'quiz' && <QuizAnswersList answers={selectedItem.answers || []} />}

                        {selectedItem.type === 'complex' && (
                            <div className="sp-complex-details">
                                {selectedItem.steps?.map((s, i) => (
                                    <div key={i} className={`sp-step-row ${s.passed ? 'pass' : 'fail'}`}>
                                        <span>{s.title}</span>
                                        <span>{s.score}/{s.total} ({s.percentage}%)</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </DetailModal>
        </div>
    );
};

export default StudentProfile;
