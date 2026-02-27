import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './VisualGameBuilder.css';

const genNodeId = () => `n_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genChoiceId = () => `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genCharId = () => `ch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

const AVATAR_PRESETS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🤵', '👰', '👨‍💼', '👩‍💼', '🧑‍💼', '👮', '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧙', '🦸', '🦹', '🤖', '😊', '👤'];
const COLOR_PRESETS = ['#38bdf8', '#4caf50', '#ff9800', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b'];

const VisualGameBuilder = () => {
    const [scenarios, setScenarios] = useState([]);
    const [editing, setEditing] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [copyStatus, setCopyStatus] = useState(null);
    const [linkingFrom, setLinkingFrom] = useState(null); // { nodeId, choiceId }
    const [activeTab, setActiveTab] = useState('canvas'); // 'canvas' | 'characters'
    const [charForm, setCharForm] = useState(null);

    const canvasRef = useRef(null);

    useEffect(() => {
        fetchScenarios();
    }, []);

    const fetchScenarios = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/game-scenarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setScenarios(res.data);
        } catch (err) {
            console.error('fetchScenarios:', err);
        }
    };

    const handleCopyLink = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/game-links`, { scenarioId: id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await navigator.clipboard.writeText(`${window.location.origin}/game/${res.data.hash}`);
            setCopyStatus(id);
            setTimeout(() => setCopyStatus(null), 3000);
        } catch (err) {
            console.error('handleCopyLink:', err);
            alert('Помилка копіювання');
        }
    };

    const openNew = () => {
        const startId = genNodeId();
        setEditing({
            _id: null,
            title: 'Новий сценарій',
            description: '',
            startNodeId: startId,
            characters: [],
            nodes: [
                {
                    nodeId: startId,
                    text: 'Початкова сцена',
                    speakerId: null,
                    choices: [],
                    x: 100,
                    y: 100
                }
            ]
        });
        setSelectedNodeId(startId);
        setActiveTab('canvas');
    };

    const normalizeScenario = (data) => ({
        ...data,
        characters: data.characters || [],
        nodes: data.nodes.map((n, i) => ({
            ...n,
            x: n.x || (100 + i * 250),
            y: n.y || 100,
            speakerId: n.speakerId || null,
            choices: (n.choices || []).map(c => ({
                ...c,
                choiceId: c.choiceId || genChoiceId()
            }))
        }))
    });

    const openEdit = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/game-scenarios/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditing(normalizeScenario(res.data));
            setSelectedNodeId(res.data.startNodeId);
            setActiveTab('canvas');
        } catch (err) {
            console.error('openEdit:', err);
        }
    };

    const handleSave = async () => {
        if (!editing.title.trim()) { alert('Введіть назву'); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const payload = {
                title: editing.title,
                description: editing.description,
                startNodeId: editing.startNodeId,
                characters: (editing.characters || []).map(c => ({
                    charId: c.charId,
                    name: c.name,
                    avatar: c.avatar,
                    color: c.color,
                    description: c.description
                })),
                nodes: editing.nodes.map(n => ({
                    nodeId: n.nodeId,
                    text: n.text,
                    speakerId: n.speakerId,
                    x: n.x,
                    y: n.y,
                    choices: n.choices.map(c => ({
                        text: c.text,
                        nextNodeId: c.nextNodeId || null,
                        isWin: c.isWin,
                        result: c.result
                    }))
                }))
            };
            if (editing._id) {
                await axios.put(`${API_URL}/game-scenarios/${editing._id}`, payload, config);
            } else {
                const res = await axios.post(`${API_URL}/game-scenarios`, payload, config);
                // Update local state with new ID from server
                setEditing(prev => ({ ...prev, _id: res.data._id }));
            }
            await fetchScenarios();
            // We no longer call setEditing(null) to keep editor open
            setLinkingFrom(null);
            setCharForm(null);
            setCopyStatus('SAVED_OK');
            setTimeout(() => setCopyStatus(null), 2000);
        } catch (err) {
            console.error('handleSave:', err);
            alert('Помилка збереження');
        } finally {
            setSaving(false);
        }
    };

    // --- Canvas Events ---
    const handleWheel = (e) => {
        // Only zoom if on canvas or canvas content
        const scaleFactor = 0.1;
        const newZoom = e.deltaY > 0 ? Math.max(0.2, zoom - scaleFactor) : Math.min(2, zoom + scaleFactor);

        // Zoom towards mouse position
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomRatio = newZoom / zoom;

        setCanvasOffset(prev => ({
            x: mouseX - (mouseX - prev.x) * zoomRatio,
            y: mouseY - (mouseY - prev.y) * zoomRatio
        }));
        setZoom(newZoom);
    };

    const handleMouseDown = (e) => {
        if (linkingFrom) {
            setLinkingFrom(null);
            return;
        }
        if (e.target === canvasRef.current || e.target.classList.contains('vb-canvas-content')) {
            setIsDraggingCanvas(true);
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const curMouseX = (e.clientX - rect.left - canvasOffset.x) / zoom;
        const curMouseY = (e.clientY - rect.top - canvasOffset.y) / zoom;

        if (isDraggingCanvas) {
            const dx = e.clientX - mousePos.x;
            const dy = e.clientY - mousePos.y;
            setCanvasOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setMousePos({ x: e.clientX, y: e.clientY });
        } else if (isDraggingNode && draggedNodeId) {
            const dx = (e.clientX - mousePos.x) / zoom;
            const dy = (e.clientY - mousePos.y) / zoom;
            setEditing(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.nodeId === draggedNodeId
                        ? { ...n, x: n.x + dx, y: n.y + dy }
                        : n
                )
            }));
            setMousePos({ x: e.clientX, y: e.clientY });
        }

        if (linkingFrom) {
            setMousePos({ x: curMouseX, y: curMouseY });
        }
    };

    const handleMouseUp = () => {
        setIsDraggingCanvas(false);
        setIsDraggingNode(false);
        setDraggedNodeId(null);
    };

    const handleNodeMouseDown = (e, nodeId) => {
        e.stopPropagation();
        if (linkingFrom) {
            // Complete connection
            const { nodeId: sourceId, choiceId } = linkingFrom;
            if (sourceId === nodeId) return; // Can't connect to self for now simply

            setEditing(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.nodeId === sourceId
                        ? { ...n, choices: n.choices.map(c => c.choiceId === choiceId ? { ...c, nextNodeId: nodeId } : c) }
                        : n
                )
            }));
            setLinkingFrom(null);
            return;
        }
        setIsDraggingNode(true);
        setDraggedNodeId(nodeId);
        setSelectedNodeId(nodeId);
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    // --- Actions ---
    const addNode = () => {
        const id = genNodeId();
        setEditing(prev => ({
            ...prev,
            nodes: [...prev.nodes, {
                nodeId: id,
                text: 'Нова сцена',
                choices: [],
                x: 200 - canvasOffset.x,
                y: 200 - canvasOffset.y
            }]
        }));
        setSelectedNodeId(id);
    };

    const addChoice = () => {
        if (!selectedNodeId) return;
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId
                    ? { ...n, choices: [...n.choices, { choiceId: genChoiceId(), text: 'Вибір...', nextNodeId: null }] }
                    : n
            )
        }));
    };

    const updateSelectedNode = (field, value) => {
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId ? { ...n, [field]: value } : n
            )
        }));
    };

    const updateChoice = (choiceId, field, value) => {
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId
                    ? { ...n, choices: n.choices.map(c => c.choiceId === choiceId ? { ...c, [field]: value } : c) }
                    : n
            )
        }));
    };

    const saveChar = () => {
        if (!charForm.name.trim()) { alert('Введіть ім\'я персонажа'); return; }
        setEditing(prev => {
            if (charForm.charId) {
                return {
                    ...prev,
                    characters: prev.characters.map(c => c.charId === charForm.charId ? { ...charForm } : c)
                };
            }
            return {
                ...prev,
                characters: [...prev.characters, { ...charForm, charId: genCharId() }]
            };
        });
        setCharForm(null);
    };

    const deleteChar = (charId) => {
        setEditing(prev => ({
            ...prev,
            characters: prev.characters.filter(c => c.charId !== charId),
            nodes: prev.nodes.map(n => n.speakerId === charId ? { ...n, speakerId: null } : n)
        }));
    };

    // --- Rendering Helpers ---
    const renderConnections = () => {
        if (!editing) return null;
        return (
            <svg className="vb-connections-svg">
                {editing.nodes.map(node =>
                    node.choices.map((choice, i) => {
                        if (!choice.nextNodeId) return null;
                        const target = editing.nodes.find(n => n.nodeId === choice.nextNodeId);
                        if (!target) return null;

                        const startX = node.x + 220;
                        const startY = node.y + 60 + (i * 30);
                        const endX = target.x;
                        const endY = target.y + 40;

                        const cp1x = startX + 50;
                        const cp2x = endX - 50;

                        return (
                            <path
                                key={`${node.nodeId}-${choice.choiceId || i}`}
                                d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
                                className="vb-link-path"
                            />
                        );
                    })
                )}
                {renderGhostLink()}
            </svg>
        );
    };

    const renderGhostLink = () => {
        if (!linkingFrom) return null;
        const node = editing.nodes.find(n => n.nodeId === linkingFrom.nodeId);
        if (!node) return null;
        const i = node.choices.findIndex(c => c.choiceId === linkingFrom.choiceId);

        const startX = node.x + 220;
        const startY = node.y + 60 + (i * 30);
        const endX = mousePos.x;
        const endY = mousePos.y;

        const cp1x = startX + 50;
        const cp2x = endX - 50;

        return (
            <path
                d={`M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`}
                className="vb-link-path active"
                style={{ strokeDasharray: '5,5' }}
            />
        );
    };

    if (!editing) {
        return (
            <div className="game-builder-container">
                <div className="content-header">
                    <h2>🗺️ Візуальний конструктор</h2>
                    <button className="btn-add" onClick={openNew}>+ Створити гру</button>
                </div>
                <div className="scenarios-grid">
                    {scenarios.map(s => (
                        <div key={s._id} className="scenario-card">
                            <div className="scenario-card-header">
                                <h3>{s.title}</h3>
                                {copyStatus === s._id && <span className="copy-confirm">✓ Скопійовано</span>}
                            </div>
                            <p>{s.description}</p>
                            <div className="scenario-card-footer">
                                <span className="scenario-date">{new Date(s.createdAt).toLocaleDateString('uk-UA')}</span>
                                <div className="scenario-actions">
                                    <button className="scenario-btn" title="Копіювати посилання" onClick={() => handleCopyLink(s._id)}>📋</button>
                                    <button className="scenario-btn" title="Відкрити" onClick={() => openEdit(s._id)}>✏️</button>
                                    <button className="scenario-btn scenario-btn-danger" title="Видалити" onClick={() => {
                                        if (window.confirm('Видалити?')) {
                                            const token = localStorage.getItem('token');
                                            axios.delete(`${API_URL}/game-scenarios/${s._id}`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            }).then(fetchScenarios);
                                        }
                                    }}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const selectedNode = editing.nodes.find(n => n.nodeId === selectedNodeId);

    return (
        <div className="visual-builder-container">
            <header className="vb-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <input
                        className="vb-title-input"
                        value={editing.title}
                        onChange={e => setEditing({ ...editing, title: e.target.value })}
                    />
                    <div className="vb-tabs" style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={`vb-tab-btn ${activeTab === 'canvas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('canvas')}
                        >🗺️ Канвас</button>
                        <button
                            className={`vb-tab-btn ${activeTab === 'characters' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('characters'); setCharForm(null); }}
                        >🧑 Персонажі ({editing.characters.length})</button>
                    </div>
                </div>
                <div className="vb-actions">
                    {editing._id && (
                        <button className="vb-btn vb-btn-secondary" onClick={() => handleCopyLink(editing._id)}>
                            {copyStatus === editing._id ? '✓ Скопійовано' : '🔗 Посилання'}
                        </button>
                    )}
                    <button className="vb-btn vb-btn-secondary" onClick={() => { setEditing(null); setLinkingFrom(null); setCharForm(null); }}>Скасувати</button>
                    <button className="vb-btn vb-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Збереження...' : (copyStatus === 'SAVED_OK' ? 'Збережено ✓' : 'Зберегти')}
                    </button>
                </div>
            </header>

            <div className="vb-main">
                {activeTab === 'canvas' ? (
                    <div
                        className="vb-canvas"
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        style={{
                            backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
                            backgroundSize: `${30 * zoom}px ${30 * zoom}px`
                        }}
                    >
                        <div className="vb-canvas-content" style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})` }}>
                            {renderConnections()}
                            {editing.nodes.map(node => {
                                const speaker = node.speakerId ? editing.characters.find(c => c.charId === node.speakerId) : null;
                                return (
                                    <div
                                        key={node.nodeId}
                                        className={`vb-node ${selectedNodeId === node.nodeId ? 'selected' : ''} ${editing.startNodeId === node.nodeId ? 'start-node' : ''} ${linkingFrom ? 'linking-target' : ''}`}
                                        style={{ left: node.x, top: node.y }}
                                        onMouseDown={(e) => handleNodeMouseDown(e, node.nodeId)}
                                    >
                                        {speaker && (
                                            <div className="vb-node-speaker" style={{ borderColor: speaker.color }}>
                                                {speaker.avatar}
                                            </div>
                                        )}
                                        <div className="vb-port vb-port-in"></div>
                                        <div className="vb-node-header">
                                            <span className="vb-node-icon">{editing.startNodeId === node.nodeId ? '🚀' : '📝'}</span>
                                            <span className="vb-node-title">Сцена</span>
                                        </div>
                                        <div className="vb-node-content">
                                            <div className="vb-node-text">{node.text || 'Текст відсутній...'}</div>
                                            <div className="vb-node-choices-dots">
                                                {node.choices.map((c, i) => (
                                                    <div key={i} className="vb-choice-dot" style={{ top: 60 + i * 30 }}></div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="vb-port vb-port-out"></div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="vb-floating-actions">
                            <div style={{ color: '#666', fontSize: '0.8rem', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
                                {Math.round(zoom * 100)}%
                            </div>
                            <button className="vb-float-btn" onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}>
                                <span>➕</span>
                                <span>Scale Up</span>
                            </button>
                            <button className="vb-float-btn" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}>
                                <span>➖</span>
                                <span>Scale Down</span>
                            </button>
                            <button className="vb-float-btn" onClick={addNode}>
                                <span>📂</span>
                                <span>Додати вузол</span>
                            </button>
                            <button className="vb-float-btn" onClick={() => { setCanvasOffset({ x: 0, y: 0 }); setZoom(1); }}>
                                <span>🎯</span>
                                <span>Центрувати</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="vb-characters-view" style={{ flex: 1, padding: '40px', overflowY: 'auto', background: '#111' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ color: '#fff' }}>Персонажі ({editing.characters.length})</h2>
                            <button className="vb-btn vb-btn-primary" onClick={() => setCharForm({ charId: null, name: '', avatar: '🧑', color: '#38bdf8', description: '' })}>
                                + Додати персонажа
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                            {editing.characters.map(char => (
                                <div key={char.charId} style={{ background: '#1a1a1a', borderRadius: '15px', padding: '20px', border: '1px solid #333', display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <div style={{ fontSize: '3rem', background: char.color + '22', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: char.color }}>
                                        {char.avatar}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ color: '#fff', margin: '0 0 5px 0' }}>{char.name}</h3>
                                        <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>{char.description || 'Без опису'}</p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button className="vb-btn" onClick={() => setCharForm({ ...char })}>✏️</button>
                                        <button className="vb-btn" style={{ color: '#ef4444' }} onClick={() => deleteChar(char.charId)}>🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                )}

                <aside className="vb-sidebar">
                    <div className="vb-sidebar-header">
                        <h3>Налаштування вузла</h3>
                    </div>
                    <div className="vb-sidebar-content">
                        {selectedNode ? (
                            <>
                                <div className="vb-form-group">
                                    <label className="vb-label">Хто говорить?</label>
                                    <div style={{ position: 'relative' }}>
                                        <select
                                            className="vb-select"
                                            value={selectedNode.speakerId || ''}
                                            onChange={e => updateSelectedNode('speakerId', e.target.value || null)}
                                        >
                                            <option value="">🗣️ Диктор (без аватара)</option>
                                            {editing.characters.map(c => (
                                                <option key={c.charId} value={c.charId}>{c.avatar} {c.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="vb-tab-btn"
                                            style={{
                                                fontSize: '0.75rem',
                                                marginTop: '4px',
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: 'var(--n8n-blue)',
                                                background: 'rgba(56, 189, 248, 0.1)'
                                            }}
                                            onClick={() => setCharForm({ charId: null, name: '', avatar: '🧑', color: '#38bdf8', description: '' })}
                                        >
                                            <span>+</span> {editing.characters.length === 0 ? 'Створити персонажів' : 'Додати ще'}
                                        </button>
                                    </div>
                                </div>

                                <div className="vb-form-group">
                                    <label className="vb-label">Текст сцени</label>
                                    <textarea
                                        className="vb-textarea"
                                        rows={4}
                                        value={selectedNode.text}
                                        onChange={e => updateSelectedNode('text', e.target.value)}
                                    />
                                </div>

                                <div className="vb-form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <label className="vb-label" style={{ marginBottom: 0 }}>Вибори (Кнопки)</label>
                                        <button className="vb-btn vb-btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={addChoice}>
                                            + Додати
                                        </button>
                                    </div>
                                    {selectedNode.choices.map((choice, i) => (
                                        <div key={choice.choiceId || i} style={{ marginBottom: '15px', padding: '12px', background: '#222', borderRadius: '10px', border: choice.choiceId === linkingFrom?.choiceId ? '1px solid var(--n8n-accent)' : '1px solid #333' }}>
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                <input
                                                    className="vb-input"
                                                    value={choice.text}
                                                    onChange={e => updateChoice(choice.choiceId, 'text', e.target.value)}
                                                    placeholder="Текст кнопки"
                                                />
                                                <button
                                                    className={`vb-btn ${choice.choiceId === linkingFrom?.choiceId ? 'vb-btn-primary' : 'vb-btn-secondary'}`}
                                                    style={{ padding: '8px' }}
                                                    onClick={() => setLinkingFrom({ nodeId: selectedNode.nodeId, choiceId: choice.choiceId })}
                                                    title="З'єднати з іншим вузлом"
                                                >
                                                    🔗
                                                </button>
                                            </div>
                                            <select
                                                className="vb-select"
                                                value={choice.nextNodeId || ''}
                                                onChange={e => updateChoice(choice.choiceId, 'nextNodeId', e.target.value || null)}
                                            >
                                                <option value="">🔚 Кінець гри</option>
                                                {editing.nodes
                                                    .filter(n => n.nodeId !== selectedNode.nodeId)
                                                    .map(n => <option key={n.nodeId} value={n.nodeId}>→ {n.text.substring(0, 30)}...</option>)
                                                }
                                            </select>
                                            {!choice.nextNodeId && (
                                                <div className="vb-choice-result-fields" style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                                                    <label className="win-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '0.8rem', marginBottom: '8px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={choice.isWin}
                                                            onChange={e => updateChoice(choice.choiceId, 'isWin', e.target.checked)}
                                                        />
                                                        <span>Це перемога? 🏆</span>
                                                    </label>
                                                    <textarea
                                                        className="vb-textarea"
                                                        style={{ fontSize: '0.8rem', padding: '8px' }}
                                                        placeholder="Опис результату (прилетить на сторінку результатів)..."
                                                        rows={2}
                                                        value={choice.result || ''}
                                                        onChange={e => updateChoice(choice.choiceId, 'result', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p style={{ color: '#666' }}>Оберіть вузол на канвасі</p>
                        )}
                    </div>
                </aside>
            </div>
            {charForm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '20px', width: '450px', border: '1px solid #333' }}>
                        <h3 style={{ color: '#fff', marginBottom: '20px' }}>{charForm.charId ? 'Редагувати' : 'Створити'} персонажа</h3>

                        <div className="vb-form-group">
                            <label className="vb-label">Ім'я</label>
                            <input className="vb-input" value={charForm.name} onChange={e => setCharForm({ ...charForm, name: e.target.value })} />
                        </div>

                        <div className="vb-form-group">
                            <label className="vb-label">Аватар</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '5px', marginBottom: '10px' }}>
                                {AVATAR_PRESETS.map(a => (
                                    <button key={a} onClick={() => setCharForm({ ...charForm, avatar: a })} style={{ background: charForm.avatar === a ? '#333' : 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', borderRadius: '5px', padding: '5px' }}>{a}</button>
                                ))}
                            </div>
                            <input className="vb-input" placeholder="Або вставте свій емодзі" value={charForm.avatar} onChange={e => setCharForm({ ...charForm, avatar: e.target.value })} />
                        </div>

                        <div className="vb-form-group">
                            <label className="vb-label">Колір</label>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                {COLOR_PRESETS.map(c => (
                                    <button key={c} onClick={() => setCharForm({ ...charForm, color: c })} style={{ width: '30px', height: '30px', background: c, border: charForm.color === c ? '2px solid #fff' : 'none', borderRadius: '50%', cursor: 'pointer' }} />
                                ))}
                            </div>
                            <input type="color" value={charForm.color} onChange={e => setCharForm({ ...charForm, color: e.target.value })} />
                        </div>

                        <div className="vb-form-group">
                            <label className="vb-label">Опис</label>
                            <textarea className="vb-textarea" rows={2} value={charForm.description} onChange={e => setCharForm({ ...charForm, description: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                            <button className="vb-btn vb-btn-primary" style={{ flex: 1 }} onClick={saveChar}>Зберегти</button>
                            <button className="vb-btn vb-btn-secondary" style={{ flex: 1 }} onClick={() => setCharForm(null)}>Скасувати</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualGameBuilder;
