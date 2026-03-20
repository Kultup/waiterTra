import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL, { getUserPlatform } from '../api';
import ConfirmModal from './ConfirmModal';
import './GameBuilder.css';

// ── ID generators ────────────────────────────────────────────────────────────
const genNodeId = () => `n_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genChoiceId = () => `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genCharId = () => `ch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

// ── Presets ──────────────────────────────────────────────────────────────────
const AVATAR_PRESETS = [
    '🧑‍🍳', '👨‍🍳', '👩‍🍳', '🤵', '👰', '👨‍💼', '👩‍💼', '🧑‍💼',
    '👮', '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧙', '🦸', '🦹', '🤖', '😊', '👤'
];
const COLOR_PRESETS = [
    '#38bdf8', '#4caf50', '#ff9800', '#ef4444',
    '#a855f7', '#ec4899', '#14b8a6', '#f59e0b'
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const normalizeScenario = (data) => ({
    ...data,
    characters: data.characters || [],
    nodes: data.nodes.map(node => ({
        ...node,
        speakerId: node.speakerId || null,
        choices: node.choices.map(c => ({ ...c, choiceId: genChoiceId() }))
    }))
});

const makeEmptyScenario = () => {
    const startId = genNodeId();
    return {
        _id: null,
        title: '',
        description: '',
        startNodeId: startId,
        characters: [],
        nodes: [{ nodeId: startId, text: '', speakerId: null, choices: [] }]
    };
};

const emptyCharForm = () => ({ charId: null, name: '', avatar: '🧑', color: '#38bdf8', description: '' });

// ── GameBuilder ──────────────────────────────────────────────────────────────
const GameBuilder = () => {
    const [scenarios, setScenarios] = useState([]);
    const [editing, setEditing] = useState(null);
    const [selectedNodeId, setSelected] = useState(null);
    const [activeTab, setActiveTab] = useState('nodes');   // 'nodes' | 'characters'
    const [charForm, setCharForm] = useState(null);      // null = hidden
    const [copyStatus, setCopyStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [cities, setCities] = useState([]);
    const [filterCity, setFilterCity] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });

    useEffect(() => {
        fetchUser();
        fetchCities();
        fetchScenarios();
    }, []);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (e) { console.error('fetchUser:', e); }
    };

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`);
            setCities(res.data);
        } catch (e) { console.error('fetchCities:', e); }
    };

    const fetchScenarios = async () => {
        try {
            const res = await axios.get(`${API_URL}/game-scenarios`);
            setScenarios(res.data);
        } catch (err) { console.error('fetchScenarios:', err); }
    };

    const openNew = () => {
        const s = makeEmptyScenario();
        setEditing(s);
        setSelected(s.startNodeId);
        setActiveTab('nodes');
    };

    const openEdit = async (id) => {
        try {
            const res = await axios.get(`${API_URL}/game-scenarios/${id}`);
            setEditing(normalizeScenario(res.data));
            setSelected(normalizeScenario(res.data).startNodeId);
            setActiveTab('nodes');
        } catch (err) { console.error('openEdit:', err); }
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.idToDelete;
        if (!id) return;
        setConfirmModal({ isOpen: false, idToDelete: null });
        try {
            await axios.delete(`${API_URL}/game-scenarios/${id}`);
            setScenarios(prev => prev.filter(s => s._id !== id));
        } catch (err) { console.error('handleDelete:', err); }
    };

    const handleSave = async () => {
        if (!editing.title.trim()) { alert('Введіть назву сценарію'); return; }
        setSaving(true);
        try {
            const payload = {
                title: editing.title,
                description: editing.description,
                startNodeId: editing.startNodeId,
                characters: editing.characters.map(({ charId, name, avatar, color, description }) =>
                    ({ charId, name, avatar, color, description })
                ),
                nodes: editing.nodes.map(n => ({
                    nodeId: n.nodeId,
                    text: n.text,
                    speakerId: n.speakerId || null,
                    choices: n.choices.map(({ text, nextNodeId, isWin, result }) =>
                        ({ text, nextNodeId: nextNodeId || null, isWin, result })
                    )
                }))
            };
            if (editing._id) {
                await axios.put(`${API_URL}/game-scenarios/${editing._id}`, payload);
            } else {
                await axios.post(`${API_URL}/game-scenarios`, payload);
            }
            await fetchScenarios();
            setEditing(null);
            setSelected(null);
            setCharForm(null);
        } catch (err) {
            console.error('handleSave:', err);
            alert('Помилка збереження');
        } finally { setSaving(false); }
    };

    const handleCopyLink = async (id) => {
        try {
            const res = await axios.post(`${API_URL}/game-links`, { scenarioId: id });
            await navigator.clipboard.writeText(`${window.location.origin}/game/${res.data.hash}`);
            setCopyStatus(id);
            setTimeout(() => setCopyStatus(null), 3000);
        } catch (err) { console.error('handleCopyLink:', err); }
    };

    // ── Node operations ──────────────────────────────────────────────────────

    const addNode = () => {
        const nodeId = genNodeId();
        setEditing(prev => ({
            ...prev,
            nodes: [...prev.nodes, { nodeId, text: '', speakerId: null, choices: [] }]
        }));
        setSelected(nodeId);
    };

    const deleteNode = (nodeId) => {
        if (editing.nodes.length <= 1) { alert('Потрібен хоча б один вузол'); return; }
        if (nodeId === editing.startNodeId) { alert('Не можна видалити стартовий вузол'); return; }
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes
                .filter(n => n.nodeId !== nodeId)
                .map(n => ({
                    ...n,
                    choices: n.choices.map(c =>
                        c.nextNodeId === nodeId ? { ...c, nextNodeId: null } : c
                    )
                }))
        }));
        setSelected(editing.startNodeId);
    };

    const updateNodeField = (nodeId, field, value) =>
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.nodeId === nodeId ? { ...n, [field]: value } : n)
        }));

    const setStartNode = (nodeId) =>
        setEditing(prev => ({ ...prev, startNodeId: nodeId }));

    // ── Choice operations ────────────────────────────────────────────────────

    const addChoice = (nodeId) => {
        const choiceId = genChoiceId();
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === nodeId
                    ? { ...n, choices: [...n.choices, { choiceId, text: '', nextNodeId: null, isWin: false, result: '' }] }
                    : n
            )
        }));
    };

    const updateChoice = (nodeId, choiceId, field, value) =>
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === nodeId
                    ? { ...n, choices: n.choices.map(c => c.choiceId === choiceId ? { ...c, [field]: value } : c) }
                    : n
            )
        }));

    const deleteChoice = (nodeId, choiceId) =>
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === nodeId
                    ? { ...n, choices: n.choices.filter(c => c.choiceId !== choiceId) }
                    : n
            )
        }));

    // ── Character operations ─────────────────────────────────────────────────

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
            // unset speakerId on nodes that used this character
            nodes: prev.nodes.map(n => n.speakerId === charId ? { ...n, speakerId: null } : n)
        }));
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const nodeLabel = (node) => {
        if (!node.text) return '(без тексту)';
        return node.text.length > 32 ? node.text.substring(0, 32) + '…' : node.text;
    };

    // ════════════════════════════════════════════════════════════════════════
    // EDITOR VIEW
    // ════════════════════════════════════════════════════════════════════════
    if (editing) {
        const selectedNode = editing.nodes.find(n => n.nodeId === selectedNodeId);

        return (
            <div className="game-builder-editor">

                {/* Header */}
                <header className="builder-header">
                    <div className="builder-title-area">
                        <input
                            className="builder-title-input"
                            value={editing.title}
                            onChange={e => setEditing(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Назва сценарію..."
                        />
                        <input
                            className="builder-desc-input"
                            value={editing.description}
                            onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Короткий опис (необов'язково)..."
                        />
                    </div>
                    <div className="builder-header-actions">
                        {/* Tab switcher */}
                        <div className="builder-tabs">
                            <button
                                className={`builder-tab ${activeTab === 'nodes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('nodes')}
                            >🗂 Сцени</button>
                            <button
                                className={`builder-tab ${activeTab === 'characters' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('characters'); setCharForm(null); }}
                            >
                                🧑 Персонажі
                                {editing.characters.length > 0 && (
                                    <span className="tab-badge">{editing.characters.length}</span>
                                )}
                            </button>
                        </div>
                        <button className="btn-save-template" onClick={handleSave} disabled={saving}>
                            {saving ? '⏳ Збереження…' : '💾 Зберегти'}
                        </button>
                        <button className="btn-cancel" onClick={() => { setEditing(null); setCharForm(null); }}>
                            Закрити
                        </button>
                    </div>
                </header>

                {/* ── Tab: Nodes ── */}
                {activeTab === 'nodes' && (
                    <div className="builder-main">
                        {/* Nodes sidebar */}
                        <aside className="builder-nodes-panel">
                            <div className="nodes-panel-header">
                                <span>Вузли ({editing.nodes.length})</span>
                                <button className="btn-add-node" onClick={addNode}>+ Додати</button>
                            </div>
                            <div className="nodes-list">
                                {editing.nodes.map(node => {
                                    const speaker = editing.characters.find(c => c.charId === node.speakerId);
                                    return (
                                        <div
                                            key={node.nodeId}
                                            className={`node-list-item ${selectedNodeId === node.nodeId ? 'active' : ''}`}
                                            onClick={() => setSelected(node.nodeId)}
                                        >
                                            <div className="node-list-info">
                                                {editing.startNodeId === node.nodeId && (
                                                    <span className="node-start-badge">START</span>
                                                )}
                                                {speaker && (
                                                    <span className="node-speaker-badge" style={{ color: speaker.color }}>
                                                        {speaker.avatar} {speaker.name}
                                                    </span>
                                                )}
                                                <span className="node-list-preview">{nodeLabel(node)}</span>
                                                <span className="node-choices-count">{node.choices.length} вибори</span>
                                            </div>
                                            {editing.startNodeId !== node.nodeId && (
                                                <button
                                                    className="node-delete-btn"
                                                    onClick={e => { e.stopPropagation(); deleteNode(node.nodeId); }}
                                                >×</button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </aside>

                        {/* Node editor */}
                        <div className="builder-node-editor">
                            {selectedNode ? (
                                <>
                                    <div className="node-editor-header">
                                        <h3>Редагування сцени</h3>
                                        {editing.startNodeId === selectedNode.nodeId
                                            ? <span className="start-badge-inline">▶ Стартова сцена</span>
                                            : <button className="btn-set-start" onClick={() => setStartNode(selectedNode.nodeId)}>▶ Зробити стартовою</button>
                                        }
                                    </div>

                                    {/* Speaker selector */}
                                    <div className="speaker-field">
                                        <label className="speaker-label">Хто говорить?</label>
                                        <select
                                            className="speaker-select"
                                            value={selectedNode.speakerId || ''}
                                            onChange={e => updateNodeField(selectedNode.nodeId, 'speakerId', e.target.value || null)}
                                        >
                                            <option value="">— Нарація (без персонажа) —</option>
                                            {editing.characters.map(c => (
                                                <option key={c.charId} value={c.charId}>
                                                    {c.avatar} {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        {editing.characters.length === 0 && (
                                            <button
                                                className="btn-goto-chars"
                                                onClick={() => setActiveTab('characters')}
                                            >+ Додати персонажів</button>
                                        )}
                                    </div>

                                    <textarea
                                        className="node-text-input"
                                        value={selectedNode.text}
                                        onChange={e => updateNodeField(selectedNode.nodeId, 'text', e.target.value)}
                                        placeholder="Опишіть сцену…"
                                        rows={5}
                                    />

                                    {/* Choices */}
                                    <div className="choices-section">
                                        <div className="choices-header">
                                            <h4>Вибори гравця</h4>
                                            <button className="btn-add-choice" onClick={() => addChoice(selectedNode.nodeId)}>
                                                + Додати вибір
                                            </button>
                                        </div>
                                        {selectedNode.choices.length === 0 && (
                                            <p className="empty-choices-msg">Немає виборів — сцена буде кінцевою.</p>
                                        )}
                                        {selectedNode.choices.map((choice, idx) => {
                                            const isEnd = !choice.nextNodeId;
                                            return (
                                                <div key={choice.choiceId} className="choice-row">
                                                    <div className="choice-row-top">
                                                        <span className="choice-number">{idx + 1}</span>
                                                        <input
                                                            className="choice-text-input"
                                                            value={choice.text}
                                                            onChange={e => updateChoice(selectedNode.nodeId, choice.choiceId, 'text', e.target.value)}
                                                            placeholder="Текст вибору…"
                                                        />
                                                        <button className="choice-delete-btn" onClick={() => deleteChoice(selectedNode.nodeId, choice.choiceId)}>×</button>
                                                    </div>
                                                    <div className="choice-row-bottom">
                                                        <select
                                                            className="choice-target-select"
                                                            value={choice.nextNodeId || '__end__'}
                                                            onChange={e => updateChoice(selectedNode.nodeId, choice.choiceId, 'nextNodeId', e.target.value === '__end__' ? null : e.target.value)}
                                                        >
                                                            <option value="__end__">🔚 Кінець гри</option>
                                                            {editing.nodes
                                                                .filter(n => n.nodeId !== selectedNode.nodeId)
                                                                .map(n => (
                                                                    <option key={n.nodeId} value={n.nodeId}>→ {nodeLabel(n)}</option>
                                                                ))}
                                                        </select>
                                                        {isEnd && (
                                                            <>
                                                                <label className="win-toggle">
                                                                    <input type="checkbox" checked={choice.isWin} onChange={e => updateChoice(selectedNode.nodeId, choice.choiceId, 'isWin', e.target.checked)} />
                                                                    <span>Перемога</span>
                                                                </label>
                                                                <input
                                                                    className="choice-result-input"
                                                                    value={choice.result}
                                                                    onChange={e => updateChoice(selectedNode.nodeId, choice.choiceId, 'result', e.target.value)}
                                                                    placeholder="Текст фіналу…"
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="no-node-selected"><p>Оберіть сцену зліва</p></div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab: Characters ── */}
                {activeTab === 'characters' && (
                    <div className="characters-tab">
                        <div className="chars-list-section">
                            <div className="chars-list-header">
                                <h3>Персонажі сценарію</h3>
                                <button className="btn-add-node" onClick={() => setCharForm(emptyCharForm())}>
                                    + Додати персонажа
                                </button>
                            </div>

                            {editing.characters.length === 0 && !charForm && (
                                <div className="chars-empty">
                                    <p>Персонажів немає. Додайте першого!</p>
                                    <p className="chars-empty-hint">Персонажі відображаються в грі як портрет з ім'ям над текстом сцени.</p>
                                </div>
                            )}

                            <div className="chars-grid">
                                {editing.characters.map(char => (
                                    <div
                                        key={char.charId}
                                        className="char-card"
                                        style={{ '--char-color': char.color }}
                                    >
                                        <div className="char-card-avatar">{char.avatar}</div>
                                        <div className="char-card-info">
                                            <strong>{char.name}</strong>
                                            {char.description && <span>{char.description}</span>}
                                        </div>
                                        <div className="char-card-actions">
                                            <button className="scenario-btn" onClick={() => setCharForm({ ...char })}>✏️</button>
                                            <button className="scenario-btn scenario-btn-danger" onClick={() => deleteChar(char.charId)}>🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Inline character form */}
                        {charForm && (
                            <div className="char-form-panel">
                                <h4 className="char-form-title">{charForm.charId ? 'Редагувати персонажа' : 'Новий персонаж'}</h4>

                                <div className="char-form-row">
                                    <label>Ім'я</label>
                                    <input
                                        className="choice-text-input"
                                        value={charForm.name}
                                        onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Ім'я персонажа…"
                                        autoFocus
                                    />
                                </div>

                                <div className="char-form-row">
                                    <label>Аватар</label>
                                    <div className="avatar-presets">
                                        {AVATAR_PRESETS.map(emoji => (
                                            <button
                                                key={emoji}
                                                className={`avatar-btn ${charForm.avatar === emoji ? 'active' : ''}`}
                                                onClick={() => setCharForm(f => ({ ...f, avatar: emoji }))}
                                            >{emoji}</button>
                                        ))}
                                        <input
                                            className="avatar-custom-input"
                                            value={charForm.avatar}
                                            onChange={e => setCharForm(f => ({ ...f, avatar: e.target.value }))}
                                            placeholder="✏️"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>

                                <div className="char-form-row">
                                    <label>Колір</label>
                                    <div className="color-presets">
                                        {COLOR_PRESETS.map(color => (
                                            <button
                                                key={color}
                                                className={`color-btn ${charForm.color === color ? 'active' : ''}`}
                                                style={{ background: color }}
                                                onClick={() => setCharForm(f => ({ ...f, color }))}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            className="color-custom-input"
                                            value={charForm.color}
                                            onChange={e => setCharForm(f => ({ ...f, color: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="char-form-row">
                                    <label>Опис <span className="optional">(необов'язково)</span></label>
                                    <input
                                        className="choice-text-input"
                                        value={charForm.description}
                                        onChange={e => setCharForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Роль персонажа…"
                                    />
                                </div>

                                {/* Preview */}
                                <div className="char-preview" style={{ '--char-color': charForm.color }}>
                                    <div className="char-preview-avatar">{charForm.avatar}</div>
                                    <div className="char-preview-name">{charForm.name || 'Персонаж'}</div>
                                </div>

                                <div className="char-form-actions">
                                    <button className="btn-confirm" onClick={saveChar}>Зберегти</button>
                                    <button className="btn-cancel" onClick={() => setCharForm(null)}>Скасувати</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // SCENARIO LIST VIEW
    // ════════════════════════════════════════════════════════════════════════
    const filteredScenarios = scenarios.filter(s => !filterCity || s.targetCity === filterCity);

    return (
        <div className="game-builder-container">
            <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <h2>🎮 Ігрові сценарії</h2>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {user?.role === 'superadmin' && (
                        <div className="city-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>📍 Фільтр міста:</span>
                            <select
                                value={filterCity}
                                onChange={e => setFilterCity(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                <option value="" style={{ color: '#000' }}>Всі міста</option>
                                {cities.map(c => (
                                    <option key={c._id} value={c.name} style={{ color: '#000' }}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button className="btn-add" onClick={openNew}>+ Новий сценарій</button>
                </div>
            </div>
            {filteredScenarios.length === 0 ? (
                <div className="placeholder-view"><p>Немає сценаріїв. Створіть перший!</p></div>
            ) : (
                <div className="scenarios-grid">
                    {filteredScenarios.map(scenario => (
                        <div key={scenario._id} className="scenario-card">
                            <div className="scenario-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {scenario.title}
                                    {scenario.targetCity && <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 'normal', whiteSpace: 'nowrap' }}>📍 {scenario.targetCity}</span>}
                                </h3>
                                {copyStatus === scenario._id && <span className="copy-confirm">✓</span>}
                            </div>
                            {scenario.description && <p className="scenario-description">{scenario.description}</p>}
                            <div className="scenario-card-footer">
                                <span className="scenario-date">{new Date(scenario.createdAt).toLocaleDateString('uk-UA')}</span>
                                <div className="scenario-actions">
                                    <button className="scenario-btn" title="Копіювати посилання" onClick={() => handleCopyLink(scenario._id)}>📋</button>
                                    <button className="scenario-btn" title="Редагувати" onClick={() => openEdit(scenario._id)}>✏️</button>
                                    <button className="scenario-btn scenario-btn-danger" title="Видалити" onClick={() => setConfirmModal({ isOpen: true, idToDelete: scenario._id })}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Видалення сценарію"
                message="Ви впевнені, що хочете видалити цей ігровий сценарій? Цю дію неможливо скасувати."
                confirmText="Видалити"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
            />
        </div>
    );
};

export default GameBuilder;
