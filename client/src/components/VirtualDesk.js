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
    const [copyStatus, setCopyStatus] = useState(null);
    const [templatesOpen, setTemplatesOpen] = useState(true);

    const [modalConfig, setModalConfig] = useState({
        show: false, title: '', type: '', data: null
    });

    useEffect(() => {
        fetchItems();
        fetchTemplates();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${API_URL}/desk-items`);
            setItems(res.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchTemplates = async () => {
        try {
            const res = await axios.get(`${API_URL}/templates`);
            setTemplates(res.data || []);
        } catch (e) { console.error(e); }
    };

    const handleDeskClick = async (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 500;
        const y = ((e.clientY - rect.top) / rect.height) * 500;
        try {
            const res = await axios.post(`${API_URL}/desk-items`, {
                name: selectedDish.name, icon: selectedDish.icon, x, y, type: selectedDish.id
            });
            setItems(prev => [...prev, res.data]);
        } catch (e) { console.error(e); }
    };

    const handleDeleteItem = async (e, id) => {
        e.stopPropagation();
        try {
            await axios.delete(`${API_URL}/desk-items/${id}`);
            setItems(prev => prev.filter(i => i._id !== id));
        } catch (e) { console.error(e); }
    };

    const handleClearDesk = () => {
        setModalConfig({ show: true, title: 'Очистити стіл', type: 'clear', data: null });
    };

    const handleSaveTemplateClick = () => {
        if (!editingTemplateId) { setTemplateName(''); setTimeLimit(0); }
        setModalConfig({
            show: true,
            title: editingTemplateId ? 'Оновити шаблон' : 'Зберегти як шаблон',
            type: 'save', data: null
        });
    };

    const handleConfirmModal = async () => {
        const { type, data } = modalConfig;
        try {
            if (type === 'save') {
                if (!templateName.trim()) { alert('Введіть назву шаблону'); return; }
                const payload = {
                    name: templateName.trim(),
                    items: items.map(({ name, icon, x, y, type }) => ({ name, icon, x, y, type })),
                    timeLimit
                };
                if (editingTemplateId) {
                    await axios.put(`${API_URL}/templates/${editingTemplateId}`, payload);
                } else {
                    await axios.post(`${API_URL}/templates`, payload);
                }
                setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0);
                fetchTemplates();
            } else if (type === 'load' || type === 'edit') {
                const template = data;
                if (type === 'edit') {
                    setEditingTemplateId(template._id);
                    setTemplateName(template.name);
                    setTimeLimit(template.timeLimit || 0);
                } else {
                    setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0);
                }
                await Promise.all(items.map(i => axios.delete(`${API_URL}/desk-items/${i._id}`)));
                const newItems = await Promise.all(template.items.map(i => axios.post(`${API_URL}/desk-items`, i)));
                setItems(newItems.map(r => r.data));
            } else if (type === 'delete') {
                await axios.delete(`${API_URL}/templates/${data}`);
                setTemplates(prev => prev.filter(t => t._id !== data));
                if (editingTemplateId === data) {
                    setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0);
                }
            } else if (type === 'clear') {
                await Promise.all(items.map(i => axios.delete(`${API_URL}/desk-items/${i._id}`)));
                setItems([]);
                setEditingTemplateId(null); setTemplateName(''); setTimeLimit(0);
            }
        } catch (e) {
            console.error(e);
            alert('Помилка при виконанні дії');
        } finally {
            setModalConfig(prev => ({ ...prev, show: false }));
        }
    };

    const generateTestUrl = async (templateId) => {
        const res = await axios.post(`${API_URL}/tests`, { templateId });
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

    return (
        <div className="virtual-desk-container">

            {/* ── Header ── */}
            <header className="desk-header">
                <div className="header-info">
                    <h1>
                        {editingTemplateId ? `✏️ ${templateName}` : 'Віртуальний стіл'}
                    </h1>
                    <p>
                        {editingTemplateId
                            ? 'Редагування шаблону — змініть предмети та збережіть'
                            : `На столі: ${items.length} предмет${items.length === 1 ? '' : items.length < 5 ? 'и' : 'ів'}`}
                    </p>
                </div>
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
                    {templatesOpen && (
                        <div className="templates-list">
                            {templates.length === 0 ? (
                                <p className="empty-msg">Немає збережених шаблонів</p>
                            ) : (
                                templates.map(t => (
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
                                ))
                            )}
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
