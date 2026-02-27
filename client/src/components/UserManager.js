import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './UserManager.css';

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin', city: '' });

    useEffect(() => {
        fetchUsers();
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

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Ви впевнені?')) return;
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
                    <input
                        type="text"
                        placeholder="Місто"
                        value={newUser.city}
                        onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                    />
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
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDeleteUser(u._id)}
                                        >
                                            Видалити
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default UserManager;
