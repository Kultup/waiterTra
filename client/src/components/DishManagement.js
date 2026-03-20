import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_URL from '../api';
import ConfirmModal from './ConfirmModal';
import './DishManagement.css';
import { useToast } from '../contexts/ToastContext';

const PRESET_ICONS = [
    '🍽️', '🍷', '🍴', '🔪', '🥄', '☕', '🍲', '🥣',
    '🥡', '🥢', '🍱', '🍻', '🥃', '🍾', '🥤', '🍞'
];

const DishManagement = () => {
    const [dishes, setDishes] = useState([]);
    const [editingDish, setEditingDish] = useState(null);
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('🍽️');
    
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        fetchDishes();
    }, []);

    const fetchDishes = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/dishes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDishes(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Помилка завантаження посуду');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('Введіть назву предмету');

        try {
            const token = localStorage.getItem('token');
            const payload = { name: name.trim(), icon: icon || '🍽️' };
            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            if (editingDish) {
                await axios.put(`${API_URL}/dishes/${editingDish._id}`, payload, config);
                toast.success('Предмет оновлено успішно!');
            } else {
                await axios.post(`${API_URL}/dishes`, payload, config);
                toast.success('Предмет додано успішно!');
            }
            
            resetForm();
            fetchDishes();
        } catch (err) {
            console.error(err);
            toast.error('Сталася помилка при збереженні');
        }
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.idToDelete;
        if (!id) return;
        setConfirmModal({ isOpen: false, idToDelete: null });
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/dishes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Предмет успішно видалено!');
            fetchDishes();
        } catch (err) {
            console.error(err);
            toast.error('Сталася помилка при видаленні');
        }
    };

    const startEdit = (dish) => {
        setEditingDish(dish);
        setName(dish.name);
        setIcon(dish.icon || '🍽️');
    };

    const deleteClick = (id) => {
        setConfirmModal({ isOpen: true, idToDelete: id });
    };

    const resetForm = () => {
        setEditingDish(null);
        setName('');
        setIcon('🍽️');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setIcon(res.data.url);
            toast.success('Іконку завантажено!');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Помилка завантаження файлу');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const renderIcon = (iconValue, className = "") => {
        if (!iconValue) return null;
        const isUrl = iconValue.startsWith('http') || iconValue.startsWith('/uploads');
        if (isUrl) {
            const baseUrl = API_URL.replace('/api', '');
            const fullUrl = iconValue.startsWith('http') ? iconValue : `${baseUrl}${iconValue}`;
            return <img src={fullUrl} alt="icon" className={className} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
        }
        return <span className={className}>{iconValue}</span>;
    };

    return (
        <div className="dish-management-container">
            <header className="content-header">
                <h2>🍽️ Керування предметами столу</h2>
            </header>
            
            <div className="dish-layout">
                {/* ─ Form ─ */}
                <div className="dish-form-card">
                    <h3>{editingDish ? 'Редагувати предмет' : 'Додати новий предмет'}</h3>
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label>Назва предмету</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Напр. Бокал для вина"
                            />
                        </div>
                        <div className="form-group">
                            <label>Іконка (Емодзі або фото)</label>
                            <div className="icon-selector">
                                {PRESET_ICONS.map(i => (
                                    <button
                                        type="button"
                                        key={i}
                                        className={`icon-btn ${icon === i ? 'active' : ''}`}
                                        onClick={() => setIcon(i)}
                                    >
                                        {i}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    value={icon.startsWith('/uploads') ? '🖼️ Фото' : icon}
                                    onChange={e => setIcon(e.target.value)}
                                    placeholder="Своє 💎"
                                    className="custom-icon-input"
                                    maxLength={4}
                                    disabled={icon.startsWith('/uploads')}
                                />
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload} 
                                    style={{ display: 'none' }} 
                                    accept="image/*"
                                />
                                <button 
                                    type="button" 
                                    className="btn-upload-icon" 
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? '⌛' : '📷'}
                                </button>
                                {icon.startsWith('/uploads') && (
                                    <button 
                                        type="button" 
                                        className="btn-remove-icon" 
                                        onClick={() => setIcon('🍽️')}
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                            {icon.startsWith('/uploads') && (
                                <div className="icon-preview-large">
                                    {renderIcon(icon)}
                                </div>
                            )}
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">
                                {editingDish ? 'Зберегти зміни' : 'Створити'}
                            </button>
                            {editingDish && (
                                <button type="button" className="btn-secondary" onClick={resetForm}>
                                    Скасувати
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* ─ List ─ */}
                <div className="dish-list-card">
                    <h3>Збережені предмети ({dishes.length})</h3>
                    {dishes.length === 0 ? (
                        <div className="empty-dish-msg">
                            У вас ще немає доданих предметів. Створіть перший зліва!
                        </div>
                    ) : (
                        <div className="dish-grid">
                            {dishes.map(dish => (
                                <div key={dish._id} className="dish-item-card">
                                    <div className="dish-icon-preview">
                                        {renderIcon(dish.icon)}
                                    </div>
                                    <div className="dish-details">
                                        <h4>{dish.name}</h4>
                                        <span>Додано: {new Date(dish.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="dish-actions">
                                        <button className="btn-icon" onClick={() => startEdit(dish)} title="Редагувати">✏️</button>
                                        <button className="btn-icon btn-danger" onClick={() => deleteClick(dish._id)} title="Видалити">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Видалення предмету"
                message="Ви впевнені, що хочете видалити цей предмет столу? Це може вплинути на існуючі сервіровки."
                confirmText="Видалити предмет"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
            />
        </div>
    );
};

export default DishManagement;
