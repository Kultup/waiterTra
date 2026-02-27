import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './Dashboard.css';

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState([
        { label: 'Активні тести', value: '—', icon: '📝', color: '#00d2ff' },
        { label: 'Готові результати', value: '—', icon: '✅', color: '#4caf50' },
        { label: 'Шаблони столів', value: '—', icon: '🖥️', color: '#ff9800' },
    ]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const config = { headers: { Authorization: `Bearer ${token}` } };

                const [testsRes, resultsRes, templatesRes] = await Promise.all([
                    axios.get(`${API_URL}/tests`, config),
                    axios.get(`${API_URL}/test-results`, config),
                    axios.get(`${API_URL}/templates`, config),
                ]);
                setStats([
                    { label: 'Активні тести', value: String(testsRes.data.length), icon: '📝', color: '#00d2ff' },
                    { label: 'Готові результати', value: String(resultsRes.data.length), icon: '✅', color: '#4caf50' },
                    { label: 'Шаблони столів', value: String(templatesRes.data.length), icon: '🖥️', color: '#ff9800' },
                ]);
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Вітаємо, {user?.username || 'в ServIQ'}</h1>
                <p>Ви ввійшли як <strong>{user?.role}</strong>. Платформа навчання та оцінки персоналу</p>
            </header>

            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <div key={index} className="stat-card" style={{ borderLeft: `4px solid ${stat.color}` }}>
                        <div className="stat-icon">{stat.icon}</div>
                        <div className="stat-info">
                            <span className="stat-label">{stat.label}</span>
                            <span className="stat-value">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-content">
                <div className="chart-placeholder">
                    <h3>Останні завантажені результати</h3>
                    <div className="departments-list">
                        <p className="empty-msg">Перейдіть в розділ "Результати" для детального перегляду</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
