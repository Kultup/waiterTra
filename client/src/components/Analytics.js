import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_URL from '../api';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Analytics.css';

const TYPE_LABELS = {
    desk: 'Сервірування',
    'multi-desk': 'Мульти-стіл',
    game: 'Гра',
    quiz: 'Квіз',
    complex: 'Комплексний'
};

const PIE_COLORS = ['#38bdf8', '#6366f1', '#4ade80', '#fbbf24', '#f87171'];

const Analytics = () => {
    const [days, setDays] = useState(30);
    const [overview, setOverview] = useState(null);
    const [traffic, setTraffic] = useState(null);
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [ovRes, trRes, tsRes] = await Promise.all([
                axios.get(`${API_URL}/analytics/overview`, config),
                axios.get(`${API_URL}/analytics/traffic?days=${days}`, config),
                axios.get(`${API_URL}/analytics/tests?days=${days}`, config)
            ]);
            setOverview(ovRes.data);
            setTraffic(trRes.data);
            setTests(tsRes.data);
        } catch (err) {
            console.error('Analytics fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const typeChartData = traffic?.byType?.map(t => ({
        name: TYPE_LABELS[t._id] || t._id,
        Відвідувань: t.count
    })) || [];

    const cityPieData = traffic?.byCity?.map(c => ({
        name: c.city || 'Невідоме',
        value: c.count
    })) || [];

    if (loading) {
        return (
            <div className="analytics-page">
                <div className="an-loading">Завантаження аналітики...</div>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <div>
                    <h1>📊 Аналітика</h1>
                    <p>Трафік та активність по тестах</p>
                </div>
                <div className="analytics-controls">
                    <select
                        className="analytics-select"
                        value={days}
                        onChange={e => setDays(Number(e.target.value))}
                    >
                        <option value={7}>7 днів</option>
                        <option value={14}>14 днів</option>
                        <option value={30}>30 днів</option>
                        <option value={90}>90 днів</option>
                    </select>
                </div>
            </div>

            {/* Карточки */}
            <div className="analytics-cards">
                <div className="an-card highlight">
                    <div className="an-card-icon">👁️</div>
                    <div className="an-card-value">{overview?.views?.today ?? 0}</div>
                    <div className="an-card-label">Відвідувань сьогодні</div>
                    <div className="an-card-sub">За місяць: {overview?.views?.month ?? 0}</div>
                </div>
                <div className="an-card">
                    <div className="an-card-icon">✅</div>
                    <div className="an-card-value">{overview?.completions?.today ?? 0}</div>
                    <div className="an-card-label">Завершень сьогодні</div>
                    <div className="an-card-sub">За місяць: {overview?.completions?.month ?? 0}</div>
                </div>
                <div className="an-card">
                    <div className="an-card-icon">📈</div>
                    <div className="an-card-value">{overview?.conversion?.today ?? 0}%</div>
                    <div className="an-card-label">Конверсія (сьогодні)</div>
                    <div className="an-card-sub">За місяць: {overview?.conversion?.month ?? 0}%</div>
                </div>
                <div className="an-card">
                    <div className="an-card-icon">🔗</div>
                    <div className="an-card-value">{overview?.activeTests ?? 0}</div>
                    <div className="an-card-label">Активних посилань</div>
                    <div className="an-card-sub">Ще не пройдено</div>
                </div>
                <div className="an-card">
                    <div className="an-card-icon">📊</div>
                    <div className="an-card-value">{overview?.views?.total ?? 0}</div>
                    <div className="an-card-label">Всього відвідувань</div>
                    <div className="an-card-sub">За весь час</div>
                </div>
            </div>

            {/* Графіки */}
            <div className="analytics-charts">
                {/* Основний графік трафіку */}
                <div className="an-chart-card">
                    <p className="an-chart-title">Трафік за {days} днів</p>
                    {traffic?.chartData?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={traffic.chartData}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#555"
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={d => d.slice(5)}
                                />
                                <YAxis stroke="#555" tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                    labelStyle={{ color: '#aaa' }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area
                                    type="monotone"
                                    dataKey="views"
                                    name="Відвідувань"
                                    stroke="#38bdf8"
                                    fill="url(#colorViews)"
                                    strokeWidth={2}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="completions"
                                    name="Завершень"
                                    stroke="#4ade80"
                                    fill="url(#colorComp)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="an-empty">
                            <span className="an-empty-icon">📭</span>
                            <span>Немає даних за цей період</span>
                        </div>
                    )}
                </div>

                {/* Розподіл по типах */}
                <div className="an-chart-card">
                    <p className="an-chart-title">По типах тестів</p>
                    {typeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={typeChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis type="number" stroke="#555" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={90} stroke="#555" tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                />
                                <Bar dataKey="Відвідувань" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="an-empty">
                            <span className="an-empty-icon">📭</span>
                            <span>Немає даних</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Нижній ряд */}
            <div className="analytics-bottom">
                {/* Топ тестів */}
                <div className="an-chart-card">
                    <p className="an-chart-title">Топ тестів за відвідуваннями</p>
                    {tests.length > 0 ? (
                        <div className="an-table-wrap">
                            <table className="an-table">
                                <thead>
                                    <tr>
                                        <th>Тип</th>
                                        <th>Місто</th>
                                        <th>Відвід.</th>
                                        <th>Конверсія</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tests.slice(0, 10).map((t, i) => (
                                        <tr key={i}>
                                            <td>
                                                <span className={`type-badge type-${t.testType}`}>
                                                    {TYPE_LABELS[t.testType] || t.testType}
                                                </span>
                                            </td>
                                            <td>{t.city || '—'}</td>
                                            <td>{t.views}</td>
                                            <td>
                                                <div className="conv-bar-wrap">
                                                    <div className="conv-bar-bg">
                                                        <div
                                                            className="conv-bar-fill"
                                                            style={{ width: `${t.conversion}%` }}
                                                        />
                                                    </div>
                                                    <span className="conv-pct">{t.conversion}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="an-empty">
                            <span className="an-empty-icon">📭</span>
                            <span>Тести ще не відвідувались</span>
                        </div>
                    )}
                </div>

                {/* Географія */}
                <div className="an-chart-card">
                    <p className="an-chart-title">Географія студентів</p>
                    {cityPieData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={cityPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={70}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {cityPieData.map((_, idx) => (
                                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <ul className="an-city-list">
                                {cityPieData.map((c, i) => (
                                    <li key={i} className="an-city-item">
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                                        <span className="an-city-name">{c.name}</span>
                                        <div className="conv-bar-bg" style={{ flex: 1 }}>
                                            <div
                                                className="conv-bar-fill"
                                                style={{
                                                    width: `${Math.round((c.value / cityPieData[0].value) * 100)}%`,
                                                    background: PIE_COLORS[i % PIE_COLORS.length]
                                                }}
                                            />
                                        </div>
                                        <span className="an-city-count">{c.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div className="an-empty">
                            <span className="an-empty-icon">🗺️</span>
                            <span>Немає географічних даних</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
