import React, { useState, useEffect, useRef } from 'react';
import './VirtualDesk.css';
import API_URL from '../api';

/**
 * Shared desk placement engine — used by StudentTest and ComplexTestPlay.
 *
 * Props:
 *   dishes         — array of dish objects { id, name, icon, ... }
 *   description    — optional string (task instructions)
 *   timeLimit      — minutes (0 = no limit)
 *   onSubmit       — async (items) => { score, total, percentage, passed, validatedItems, ghostItems? }
 *   onResult       — (result) => void  — called when result is ready
 *   embedded       — boolean (true in ComplexTestPlay)
 *   nextButton     — ReactNode (custom button shown after result, e.g. "Далі →")
 */
const DeskEngine = ({ dishes, description, timeLimit = 0, onSubmit, onResult, embedded = false, nextButton }) => {
    const [items, setItems] = useState([]);
    const [selectedDish, setSelectedDish] = useState(null);
    const [result, setResult] = useState(null);
    const [ghostItems, setGhostItems] = useState([]);
    const [timeLeft, setTimeLeft] = useState(null);
    const handleCheckRef = useRef(null);

    useEffect(() => {
        if (dishes.length > 0 && !selectedDish) setSelectedDish(dishes[0]);
    }, [dishes]);

    // Timer
    useEffect(() => {
        if (timeLimit > 0 && !result) {
            setTimeLeft(timeLimit * 60);
        }
    }, [timeLimit, result]);

    useEffect(() => {
        if (timeLeft === null || result) return;
        if (timeLeft === 0) {
            handleCheckRef.current?.();
            return;
        }
        const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, result]);

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const handleDeskClick = (e) => {
        if (result || !selectedDish) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 500;
        const y = ((e.clientY - rect.top) / rect.height) * 500;
        setItems(prev => [...prev, {
            _id: Date.now().toString(),
            name: selectedDish.name,
            icon: selectedDish.icon,
            x, y,
            type: selectedDish.id
        }]);
    };

    const handleDelete = (id) => {
        if (result) return;
        setItems(prev => prev.filter(i => i._id !== id));
    };

    const handleCheck = async () => {
        if (result || items.length === 0) return;
        try {
            const payload = items.map(({ type, name, icon, x, y }) => ({ type, name, icon, x, y }));
            const res = await onSubmit(payload);
            // Merge validation into items
            const merged = items.map((item, idx) => ({
                ...item,
                isCorrect: res.validatedItems?.[idx]?.isCorrect ?? false,
            }));
            setItems(merged);
            if (res.ghostItems) setGhostItems(res.ghostItems);
            const r = { score: res.score, total: res.total, percentage: res.percentage, passed: res.passed };
            setResult(r);
            onResult?.(r);
        } catch (err) {
            console.error('Desk check error:', err);
            alert('Помилка при перевірці');
        }
    };

    handleCheckRef.current = handleCheck;

    return (
        <div className={`virtual-desk-container student-test ${result ? 'has-result' : ''}`} style={embedded ? { flex: 1 } : {}}>
            <header className="desk-header">
                <div className="header-info">
                    {description && (
                        <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '0.6rem 1rem', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                            📋 {description}
                        </div>
                    )}
                    <p>На столі: {items.length} предметів</p>
                </div>
                <div className="header-actions">
                    {timeLeft !== null && !result && (
                        <span className={`test-timer ${timeLeft < 60 ? 'timer-warning' : ''}`}
                            style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            ⏱ {formatTime(timeLeft)}
                        </span>
                    )}
                    {!result && (
                        <button className="btn-add" onClick={handleCheck} disabled={items.length === 0}>
                            Перевірити результат
                        </button>
                    )}
                    {result && nextButton}
                </div>
            </header>

            <div className="desk-body">
                <aside className="desk-panel inventory-panel">
                    <div className="panel-label">Посуд</div>
                    <div className="inventory-grid">
                        {dishes.map(dish => (
                            <div key={dish.id}
                                className={`inv-item ${selectedDish?.id === dish.id ? 'active' : ''}`}
                                onClick={() => !result && setSelectedDish(dish)}>
                                <span className="inv-icon">
                                    {(dish.icon && (dish.icon.startsWith('http') || dish.icon.startsWith('/uploads'))) ? (
                                        <img src={dish.icon.startsWith('http') ? dish.icon : `${API_URL.replace('/api', '')}${dish.icon}`} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        dish.icon || '🍽️'
                                    )}
                                </span>
                                <span className="inv-name">{dish.name}</span>
                            </div>
                        ))}
                        {dishes.length === 0 && <div className="sidebar-empty">Немає посуду</div>}
                    </div>
                </aside>

                <div className="desk-workspace">
                    <div className="square-desk" onClick={handleDeskClick}>
                        {/* Ghost items (correct positions) — shown after check */}
                        {result && ghostItems.map((target, idx) => (
                            <div key={`ghost-${idx}`} className="desk-item ghost-item"
                                style={{ left: `${(target.x / 500) * 100}%`, top: `${(target.y / 500) * 100}%` }}>
                                <span className="item-icon">
                                    {(target.icon && (target.icon.startsWith('http') || target.icon.startsWith('/uploads'))) ? (
                                        <img src={target.icon.startsWith('http') ? target.icon : `${API_URL.replace('/api', '')}${target.icon}`} alt="target" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        target.icon
                                    )}
                                </span>
                            </div>
                        ))}
                        {items.map(item => (
                            <div key={item._id}
                                className={`desk-item ${result ? (item.isCorrect ? 'correct' : 'incorrect') : ''}`}
                                style={{ left: `${(item.x / 500) * 100}%`, top: `${(item.y / 500) * 100}%` }}
                                onClick={e => e.stopPropagation()}>
                                <span className="item-icon">
                                    {(item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/uploads'))) ? (
                                        <img src={item.icon.startsWith('http') ? item.icon : `${API_URL.replace('/api', '')}${item.icon}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        item.icon
                                    )}
                                </span>
                                <span className="item-text">{item.name}</span>
                                {!result && (
                                    <button className="item-delete" onClick={() => handleDelete(item._id)}>×</button>
                                )}
                            </div>
                        ))}
                        {items.length === 0 && !result && (
                            <div className="desk-placeholder">
                                <span className="desk-icon">📋</span>
                                <span className="desk-label">Розпочніть сервірування</span>
                            </div>
                        )}
                    </div>
                </div>

                {result && (
                    <aside className="desk-panel results-panel">
                        <div className="panel-label">Результат</div>
                        <div className="result-card">
                            <div className="result-score" style={{ color: result.passed ? '#4ade80' : '#f87171' }}>
                                {result.percentage}%
                            </div>
                            <p>Правильно: {result.score} з {result.total}</p>
                            <p className="result-status">
                                {result.passed ? '✅ Пройдено!' : '❌ Не пройдено'}
                            </p>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default DeskEngine;
