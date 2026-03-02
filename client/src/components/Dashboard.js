import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    AreaChart, Area
} from 'recharts';
import API_URL from '../api';
import './Dashboard.css';

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState([
        { label: 'Всього результатів', value: '—', icon: '📊', color: '#00d2ff' },
        { label: 'Успішно', value: '—', icon: '✅', color: '#4caf50' },
        { label: 'Середній %', value: '—', icon: '📈', color: '#ff9800' },
    ]);

    const [recentResults, setRecentResults] = useState([]);
    const [passingData, setPassingData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [weakSpots, setWeakSpots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState('');
    const [cities, setCities] = useState([]);
    const [period, setPeriod] = useState(30);

    const isAdminCityOnly = user?.role !== 'superadmin' && user?.city;

    useEffect(() => {
        if (!isAdminCityOnly && user?.role === 'superadmin') {
            fetchCities();
        }
        fetchStats();
    }, [selectedCity, period]);

    const fetchCities = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/stats/cities`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCities(res.data);
        } catch (err) {
            console.error('Failed to fetch cities:', err);
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            const queryParams = new URLSearchParams();
            if (selectedCity) queryParams.append('city', selectedCity);
            queryParams.append('days', period);
            
            const statsRes = await axios.get(`${API_URL}/stats/overview?${queryParams}`, config);
            const data = statsRes.data;

            setStats([
                { label: 'Всього результатів', value: String(data.totalResults), icon: '📊', color: '#00d2ff' },
                { label: 'Успішно', value: String(data.passedResults), icon: '✅', color: '#4caf50' },
                { label: 'Середній %', value: `${data.overallPercentage}%`, icon: '📈', color: '#ff9800' },
            ]);

            setPassingData([
                { name: 'Успішно', value: data.passedResults, color: '#4ade80' },
                { name: 'Провалено', value: data.failedResults, color: '#f87171' }
            ]);

            setCategoryData([
                { name: 'Сервірування', value: data.byType.test },
                { name: 'Гра', value: data.byType.game },
                { name: 'Квіз', value: data.byType.quiz }
            ]);

            setTrendData(data.chartData);
            setWeakSpots(data.weakSpots);
            setRecentResults(data.recentResults);

        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="dashboard-loading">Завантаження статистики...</div>;

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Вітаємо, {user?.username || 'в ServIQ'}</h1>
                <p>Панель моніторингу навчання офіціантів</p>
                
                <div className="dashboard-filters">
                    {user?.role === 'superadmin' && (
                        <select 
                            value={selectedCity} 
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">Всі міста</option>
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    )}
                    <select 
                        value={period} 
                        onChange={(e) => setPeriod(Number(e.target.value))}
                        className="filter-select"
                    >
                        <option value={7}>7 днів</option>
                        <option value={14}>14 днів</option>
                        <option value={30}>30 днів</option>
                        <option value={90}>90 днів</option>
                    </select>
                </div>
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
                <div className="dashboard-charts">
                    <div className="chart-card">
                        <h3>Успішність проходження</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={passingData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {passingData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                        <Label
                                            value={passingData[0]?.value + passingData[1]?.value > 0 
                                                ? `${Math.round((passingData[0]?.value / (passingData[0]?.value + passingData[1]?.value)) * 100) || 0}%`
                                                : '0%'}
                                            position="center"
                                            className="chart-center-label"
                                            fill="#fff"
                                        />
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: '#1e293b',
                                            border: 'none',
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                        }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="chart-card">
                        <h3>Активність за категоріями</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={categoryData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="value" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="chart-card full-width">
                        <h3>Динаміка результатів</h3>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="passed" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} name="Успішно" />
                                    <Area type="monotone" dataKey="failed" stroke="#f87171" fill="#f87171" fillOpacity={0.3} name="Провалено" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="weak-spots-section">
                    <h3>🔴 Потрібно повторити</h3>
                    {weakSpots.length === 0 ? (
                        <p className="empty-msg">Поки немає даних</p>
                    ) : (
                        <table className="weak-spots-table">
                            <thead>
                                <tr>
                                    <th>Ім'я</th>
                                    <th>Тип</th>
                                    <th>Результат</th>
                                    <th>Дата</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weakSpots.map((ws, i) => (
                                    <tr key={i}>
                                        <td>{ws.student}</td>
                                        <td><span className="type-badge">{ws.type}</span></td>
                                        <td className="low-score">{ws.percentage}%</td>
                                        <td>{ws.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="recent-results-section">
                    <h3>📋 Останні результати {isAdminCityOnly && `(${user.city})`}</h3>
                    <div className="recent-list">
                        {recentResults.length === 0 ? (
                            <p className="empty-msg">Результатів поки немає</p>
                        ) : (
                            <table className="recent-table">
                                <thead>
                                    <tr>
                                        <th>Ім'я</th>
                                        <th>Місто</th>
                                        <th>Посада</th>
                                        <th>Тип</th>
                                        <th>Статус</th>
                                        <th>Дата</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentResults.map((r, i) => (
                                        <tr key={i}>
                                            <td>{r.studentLastName || r.playerLastName} {r.studentName || r.playerName}</td>
                                            <td>{r.studentCity || r.playerCity}</td>
                                            <td>{r.studentPosition || r.playerPosition || '—'}</td>
                                            <td><span className="type-badge">{r.type}</span></td>
                                            <td>
                                                <span className={`status-dot ${r.passed ? 'passed' : 'failed'}`}></span>
                                                {r.passed ? 'Успішно' : 'Провалено'}
                                            </td>
                                            <td className="date-cell">{new Date(r.completedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
