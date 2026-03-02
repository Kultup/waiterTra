import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './VirtualDesk.css';
import API_URL from '../api';

const dishList = [
    { id: 'plate', name: 'Тарілка', icon: '🍽️' },
    { id: 'glass', name: 'Склянка', icon: '🍷' },
    { id: 'fork', name: 'Виделка', icon: '🍴' },
    { id: 'knife', name: 'Ніж', icon: '🔪' },
    { id: 'spoon', name: 'Ложка', icon: '🥄' },
    { id: 'coffee', name: 'Кава', icon: '☕' },
];

const Modal = ({ show, title, onClose, onConfirm, children }) => {
    if (!show) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">{children}</div>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Скасувати</button>
                    <button className="btn-confirm" onClick={onConfirm}>Підтвердити</button>
                </div>
            </div>
        </div>
    );
};

const VirtualDesk = () => {
    const [items, setItems] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedDish, setSelectedDish] = useState(dishList[0]);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [timeLimit, setTimeLimit] = useState(0);
    const [targetCity, setTargetCity] = useState('');
    const [cities, setCities] = useState([]);
    const [filterCity, setFilterCity] = useState('');
    const [user, setUser] = useState(null);
    const [copyStatus, setCopyStatus] = useState(null);
    const [multiCopyStatus, setMultiCopyStatus] = useState(false);
    const [templatesOpen, setTemplatesOpen] = useState(true);

    const [modalConfig, setModalConfig] = useState({
        show: false, title: '', type: '', data: null
    });

    useEffect(() => {
        fetchUser();
        fetchItems();
        fetchTemplates();
        fetchCities();
    }, []);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchItems = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/desk-items`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(res.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchTemplates = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/templates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTemplates(res.data);
        } catch (err) {
            console.error('Fetch error:', err);
        }
    };

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities`);
            setCities(res.data);
        } catch (err) { console.error(err); }
    };

    const handleDeskClick = async (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 500;
        const y = ((e.clientY - rect.top) / rect.height) * 500;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/desk-items`, {
                name: selectedDish.name, icon: selectedDish.icon, x, y, type: selectedDish.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(prev => [...prev, res.data]);
        } catch (e) { console.error(e); }
    };

    const handleDeleteItem = async (e, id) => {
        e.stopPropagation();
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/desk-items/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(prev => prev.filter(i => i._id !== id));
        } catch (e) { console.error(e); }
    };

    const handleClearDesk = () => {
        setModalConfig({ show: true, title: 'Очистити стіл', type: 'clear', data: null });
    };

    const handleSaveTemplateClick = () => {
        if (!editingTemplateId) {
            setTemplateName('');
            setTimeLimit(0);
            setTargetCity('');
        }
        setModalConfig({
            show: true,
            title: editingTemplateId ? 'Оновити шаблон' : 'Зберегти як шаблон',
            type: 'save', data: null
        });
    };

    const handleConfirmModal = async () => {
        const { type, data } = modalConfig;
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (type === 'save') {
                if (!templateName.trim()) { alert('Введіть назву шаблону'); return; }
                const payload = {
                    name: templateName.trim(),
                    items: items.map(({ name, icon, x, y, type }) => ({ name, icon, x, y, type })),
                    timeLimit,
                    targetCity: user?.role === 'superadmin' ? targetCity : undefined
                };
                if (editingTemplateId) {
                    await axios.put(`${API_URL}/templates/${editingTemplateId}`, payload, config);
                } else {
                    await axios.post(`${API_URL}/templates`, payload, config);
                }
                setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0); setTargetCity('');
                fetchTemplates();
            } else if (type === 'load' || type === 'edit') {
                const template = data;
                if (type === 'edit') {
                    setEditingTemplateId(template._id);
                    setTemplateName(template.name);
                    setTimeLimit(template.timeLimit || 0);
                    setTargetCity(template.targetCity || '');
                } else {
                    setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0); setTargetCity('');
                }
                await Promise.all(items.map(i => axios.delete(`${API_URL}/desk-items/${i._id}`, config)));
                const newItems = await Promise.all(template.items.map(i => axios.post(`${API_URL}/desk-items`, i, config)));
                setItems(newItems.map(r => r.data));
            } else if (type === 'delete') {
                await axios.delete(`${API_URL}/templates/${data}`, config);
                setTemplates(prev => prev.filter(t => t._id !== data));
                if (editingTemplateId === data) {
                    setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0); setTargetCity('');
                }
            } else if (type === 'clear') {
                setItems([]);
                setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0); setTargetCity('');
            }
        } catch (e) {
            console.error(e);
            alert('Помилка при виконанні дії');
        } finally {
            setModalConfig(prev => ({ ...prev, show: false }));
        }
    };

    const generateTestUrl = async (templateId) => {
        const template = templates.find(t => t._id === templateId);
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_URL}/tests`, {
            templateId,
            targetCity: template?.targetCity || ''
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return `${window.location.origin}/test/${res.data.hash}`;
    };

    const handleCopyLink = async (templateId) => {
        try {
            const url = await generateTestUrl(templateId);
            await navigator.clipboard.writeText(url);
            setCopyStatus(templateId);
            setTimeout(() => setCopyStatus(null), 3000);
        } catch (e) { alert('Помилка при копіюванні'); }
    };

    const handleShareTelegram = async (templateId) => {
        try {
            const url = await generateTestUrl(templateId);
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Запрошую пройти тест по сервіруванню столу!')}`, '_blank');
        } catch (e) { alert('Помилка'); }
    };

    const handleCopyAllLink = async () => {
        if (templates.length === 0) { alert('Немає збережених шаблонів'); return; }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/tests/multi`, {
                templateIds: templates.map(t => t._id),
                targetCity: '' // Multi-links are usually global, or handle accordingly
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const url = `${window.location.origin}/multi-test/${res.data.hash}`;
            await navigator.clipboard.writeText(url);
            setMultiCopyStatus(true);
            setTimeout(() => setMultiCopyStatus(false), 3000);
        } catch (e) { alert('Помилка при створенні посилання'); }
    };

    return (
        <div className="virtual-desk-container">

            {/* ── Header ── */}
            <header className="desk-header">
                <div className="header-info">
                    <h1>
                        {editingTemplateId ? `✏️ ${templateName}` : '🍽️ Сервірування'}
                    </h1>
                    <p>
                        {editingTemplateId
                            ? 'Редагування шаблону — змініть предмети та збережіть'
                            : `На столі: ${items.length} предмет${items.length === 1 ? '' : items.length < 5 ? 'и' : 'ів'}`}
                    </p>
                </div>

                {user?.role === 'superadmin' && (
                    <div className="header-city-selector" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>📍 Місто:</span>
                        <select
                            value={targetCity}
                            onChange={(e) => setTargetCity(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="" style={{ color: '#000' }}>Всі міста</option>
                            {cities.map(c => (
                                <option key={c._id} value={c.name} style={{ color: '#000' }}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="header-actions">
                    {items.length > 0 && (
                        <button className="btn-header-ghost" onClick={handleClearDesk}>
                            🗑 Очистити
                        </button>
                    )}
                    {editingTemplateId && (
                        <button className="btn-header-ghost btn-cancel-edit" onClick={() => {
                            setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0);
                        }}>
                            Скасувати
                        </button>
                    )}
                    <button className="btn-save-template" onClick={handleSaveTemplateClick}>
                        {editingTemplateId ? '💾 Оновити' : '💾 Зберегти'}
                    </button>
                </div>
            </header>

            {/* ── Body ── */}
            <div className="desk-body">

                {/* Inventory (посуд) */}
                <aside className="desk-panel inventory-panel">
                    <div className="panel-label">Посуд</div>
                    <div className="inventory-grid">
                        {dishList.map(dish => (
                            <div
                                key={dish.id}
                                className={`inv-item ${selectedDish.id === dish.id ? 'active' : ''}`}
                                onClick={() => setSelectedDish(dish)}
                                title={dish.name}
                            >
                                <span className="inv-icon">{dish.icon}</span>
                                <span className="inv-name">{dish.name}</span>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Desk workspace */}
                <div className="desk-workspace">
                    <div className="square-desk" onClick={handleDeskClick}>
                        {items.map(item => (
                            <div
                                key={item._id}
                                className="desk-item"
                                style={{
                                    left: `${(item.x / 500) * 100}%`,
                                    top: `${(item.y / 500) * 100}%`
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                <span className="item-icon">{item.icon || '🍽️'}</span>
                                <span className="item-text">{item.name}</span>
                                <button className="item-delete" onClick={e => handleDeleteItem(e, item._id)}>×</button>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="desk-placeholder">
                                <span className="desk-icon">✨</span>
                                <span className="desk-label">Натисніть для розміщення</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Templates panel */}
                <aside className="desk-panel templates-panel">
                    <div className="panel-label templates-label" onClick={() => setTemplatesOpen(o => !o)}>
                        <span>Шаблони</span>
                        <span className="templates-toggle">{templatesOpen ? '▲' : '▼'}</span>
                    </div>
                    {templates.length > 0 && templatesOpen && (
                        <button
                            className={`btn-all-link ${multiCopyStatus ? 'copied' : ''}`}
                            onClick={handleCopyAllLink}
                            title="Створити посилання на проходження всіх сервіровок"
                        >
                            {multiCopyStatus ? '✓ Скопійовано!' : '🔗 Посилання на всі столи'}
                        </button>
                    )}
                    {templatesOpen && (
                        <div className="templates-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {user?.role === 'superadmin' && (
                                <div className="city-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>📍 Місто:</span>
                                    <select
                                        value={filterCity}
                                        onChange={e => setFilterCity(e.target.value)}
                                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
                                    >
                                        <option value="" style={{ color: '#000' }}>Всі міста</option>
                                        {cities.map(c => (
                                            <option key={c._id} value={c.name} style={{ color: '#000' }}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="templates-list" style={{ overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
                                {(() => {
                                    const filteredTemplates = templates.filter(t => !filterCity || t.targetCity === filterCity);
                                    if (filteredTemplates.length === 0) {
                                        return <p className="empty-msg">Немає збережених шаблонів</p>;
                                    }
                                    return filteredTemplates.map(t => (
                                        <div
                                            key={t._id}
                                            className={`template-card ${editingTemplateId === t._id ? 'active' : ''}`}
                                            onClick={() => setModalConfig({ show: true, title: 'Завантажити шаблон', type: 'load', data: t })}
                                        >
                                            <div className="tpl-main">
                                                <span className="tpl-icon">📋</span>
                                                <div className="tpl-info">
                                                    <span className="tpl-name">{t.name}</span>
                                                    <span className="tpl-meta">
                                                        {t.items?.length || 0} предм.
                                                        {t.timeLimit > 0 && ` · ⏱ ${t.timeLimit} хв`}
                                                        {t.targetCity && <span style={{ marginLeft: '8px', color: '#38bdf8' }}>📍 {t.targetCity}</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="tpl-actions">
                                                {copyStatus === t._id ? (
                                                    <span className="copied-label">✓</span>
                                                ) : (
                                                    <button className="tpl-btn" title="Скопіювати посилання" onClick={e => { e.stopPropagation(); handleCopyLink(t._id); }}>📋</button>
                                                )}
                                                <button className="tpl-btn" title="Telegram" onClick={e => { e.stopPropagation(); handleShareTelegram(t._id); }}>✈️</button>
                                                <button className="tpl-btn" title="Редагувати" onClick={e => { e.stopPropagation(); setModalConfig({ show: true, title: 'Редагувати шаблон', type: 'edit', data: t }); }}>✏️</button>
                                                <button className="tpl-btn tpl-btn-delete" title="Видалити" onClick={e => { e.stopPropagation(); setModalConfig({ show: true, title: 'Видалити шаблон', type: 'delete', data: t._id }); }}>×</button>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* ── Modal ── */}
            <Modal
                show={modalConfig.show}
                title={modalConfig.title}
                onClose={() => setModalConfig(p => ({ ...p, show: false }))}
                onConfirm={handleConfirmModal}
            >
                {modalConfig.type === 'save' ? (
                    <div className="modal-form">
                        <div className="form-group">
                            <label>Назва шаблону</label>
                            <input
                                type="text"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                placeholder="Введіть назву..."
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Час на проходження (хв, 0 — без обмежень)</label>
                            <input
                                type="number"
                                value={timeLimit}
                                onChange={e => setTimeLimit(parseInt(e.target.value) || 0)}
                                min="0"
                            />
                        </div>
                        {user?.role === 'superadmin' && (
                            <div className="form-group">
                                <label>Призначити місту (залиште порожнім для всіх)</label>
                                <select
                                    value={targetCity}
                                    onChange={e => setTargetCity(e.target.value)}
                                >
                                    <option value="">Всі міста</option>
                                    {cities.map(c => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                ) : modalConfig.type === 'load' ? (
                    <p>Завантажити шаблон "<strong>{modalConfig.data?.name}</strong>"? Поточний стіл буде очищено.</p>
                ) : modalConfig.type === 'edit' ? (
                    <p>Редагувати "<strong>{modalConfig.data?.name}</strong>"? Поточний стіл буде замінено предметами шаблону.</p>
                ) : modalConfig.type === 'clear' ? (
                    <p>Очистити стіл? Усі {items.length} предмет{items.length < 5 ? 'и' : 'ів'} буде видалено.</p>
                ) : (
                    <p>Видалити шаблон "<strong>{templates.find(t => t._id === modalConfig.data)?.name}</strong>"?</p>
                )}
            </Modal>
        </div>
    );
};

export default VirtualDesk;
