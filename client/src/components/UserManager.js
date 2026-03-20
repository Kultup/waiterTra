import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL, { getUserPlatform } from '../api';
import ConfirmModal from './ConfirmModal';
import './UserManager.css';

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin', city: '' });
    const [editingUser, setEditingUser] = useState(null);
    const [cities, setCities] = useState([]);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });

    useEffect(() => {
        fetchUsers();
        fetchCities();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch users');
            setLoading(false);
        }
    };

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`);
            setCities(res.data);
        } catch (err) {
            console.error('Failed to fetch cities:', err);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/auth/register`, newUser, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewUser({ username: '', password: '', role: 'admin', city: '' });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        }
    };

    const handleDeleteClick = (id) => {
        setConfirmModal({ isOpen: true, idToDelete: id });
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.idToDelete;
        if (!id) return;
        setConfirmModal({ isOpen: false, idToDelete: null });
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/auth/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            setError('Failed to delete user');
        }
    };

    const handleToggleBlock = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_URL}/auth/users/${id}/block`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to toggle block status');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_URL}/auth/users/${editingUser._id}`, editingUser, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update user');
        }
    };

    if (loading) return <div className="user-manager-loading">Завантаження...</div>;

    return (
        <div className="user-manager-container">
            <header className="user-manager-header">
                <h2>Управління користувачами</h2>
                <p>Тільки superadmin має доступ до цього розділу.</p>
            </header>

            <section className="role-descriptions-section">
                <h3>Права доступу за ролями</h3>
                <table className="role-desc-table">
                    <thead>
                        <tr>
                            <th>Роль</th>
                            <th>Права</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span className="role-badge superadmin">superadmin</span></td>
                            <td>Все (повний доступ до системи)</td>
                        </tr>
                        <tr>
                            <td><span className="role-badge admin">admin</span></td>
                            <td>Свої шаблони, тести, перегляд своїх результатів</td>
                        </tr>
                        <tr>
                            <td><span className="role-badge trainer">trainer</span></td>
                            <td>Лише створення тестів і перегляд результатів</td>
                        </tr>
                        <tr>
                            <td><span className="role-badge viewer">viewer</span></td>
                            <td>Лише перегляд результатів</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {error && <div className="error-message">{error}</div>}

            <section className="create-user-section">
                <h3>Створити нового користувача</h3>
                <form onSubmit={handleCreateUser} className="create-user-form">
                    <input
                        type="text"
                        placeholder="Логін"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Пароль"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                    />
                    <select
                        value={newUser.city}
                        onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                    >
                        <option value="">Виберіть місто...</option>
                        {cities.map(c => (
                            <option key={c._id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                    <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                        <option value="admin">Admin</option>
                        <option value="trainer">Trainer</option>
                        <option value="viewer">Viewer</option>
                    </select>
                    <button type="submit" className="btn-create">Створити</button>
                </form>
            </section>

            <section className="users-list-section">
                <h3>Список користувачів</h3>
                <table className="users-table">
                    <thead>
                        <tr>
                            <th>Логін</th>
                            <th>Місто</th>
                            <th>Роль</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u._id}>
                                <td>{u.username}</td>
                                <td>{u.city || '—'}</td>
                                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                                <td>
                                    {u.role !== 'superadmin' && (
                                        <div className="user-actions">
                                            <button
                                                className="btn-edit"
                                                onClick={() => setEditingUser({ ...u, password: '' })}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className={`btn-block ${u.isBlocked ? 'blocked' : ''}`}
                                                onClick={() => handleToggleBlock(u._id)}
                                                title={u.isBlocked ? 'Розблокувати' : 'Заблокувати'}
                                            >
                                                {u.isBlocked ? '🔓' : '🚫'}
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDeleteClick(u._id)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            {editingUser && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Редагувати користувача</h3>
                        <form onSubmit={handleUpdateUser} className="edit-user-form">
                            <div className="form-group">
                                <label>Логін</label>
                                <input
                                    type="text"
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Новий пароль (залиште порожнім, якщо не хочете змінювати)</label>
                                <input
                                    type="password"
                                    value={editingUser.password}
                                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                    placeholder="Введіть новий пароль"
                                />
                            </div>
                            <div className="form-group">
                                <label>Місто</label>
                                <select
                                    value={editingUser.city}
                                    onChange={(e) => setEditingUser({ ...editingUser, city: e.target.value })}
                                >
                                    <option value="">Виберіть місто...</option>
                                    {cities.map(c => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Роль</label>
                                <select
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="trainer">Trainer</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-save">Зберегти</button>
                                <button type="button" className="btn-cancel" onClick={() => setEditingUser(null)}>Скасувати</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title="Видалення користувача"
                message="Ви впевнені, що хочете видалити цього користувача? Цю дію неможливо скасувати."
                confirmText="Видалити"
                onConfirm={handleConfirmDelete}
                onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
            />
        </div>
    );
};

export default UserManager;
