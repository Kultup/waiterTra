import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../api';
import './StudentManager.css';

const StudentManager = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const res = await axios.get(`${API_URL}/students`, config);
                console.log('Fetched students:', res.data);
                setStudents(res.data);
            } catch (err) {
                console.error('Error fetching students:', err);
                setError(err.response?.data?.error || err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, []);

    const filteredStudents = students.filter(s => {
        const full = `${s.studentLastName} ${s.studentName}`.toLowerCase();
        const matchesSearch = full.includes(search.toLowerCase());
        const matchesCity = !cityFilter || s.studentCity === cityFilter;
        return matchesSearch && matchesCity;
    });

    const cities = [...new Set(students.map(s => s.studentCity).filter(Boolean))];

    if (loading) return <div className="sm-loading">Завантаження списку студентів...</div>;

    return (
        <div className="student-manager">
            <div className="sm-header">
                <div>
                    <h1>👥 Студенти</h1>
                    <p>Рейтинг та історія проходження тестів</p>
                </div>
                <div className="sm-stats-brief">
                    <div className="sm-stat-item">
                        <span className="sm-stat-val">{students.length}</span>
                        <span className="sm-stat-lab">Всього студентів</span>
                    </div>
                </div>
            </div>

            <div className="sm-controls">
                <input 
                    type="text" 
                    placeholder="🔍 Пошук за прізвищем..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="sm-search-input"
                />
                <select 
                    value={cityFilter} 
                    onChange={e => setCityFilter(e.target.value)}
                    className="sm-city-select"
                >
                    <option value="">Усі міста</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="sm-table-container">
                <table className="sm-table">
                    <thead>
                        <tr>
                            <th>Студент</th>
                            <th>Місто</th>
                            <th>Тестів</th>
                            <th>Середній бал</th>
                            <th>Остання активність</th>
                            <th>Дія</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(s => (
                            <tr key={s._id} onClick={() => navigate(`/students/${s._id}`)} className="sm-row-clickable">
                                <td className="sm-td-name">
                                    <div className="sm-avatar">{s.studentLastName[0]}{s.studentName[0]}</div>
                                    <span>{s.studentLastName} {s.studentName}</span>
                                </td>
                                <td>{s.studentCity || '—'}</td>
                                <td>{s.totalTests}</td>
                                <td>
                                    <div className="sm-score-badge" style={{ 
                                        backgroundColor: s.avgScore >= 80 ? 'rgba(74, 222, 128, 0.2)' : 
                                                        s.avgScore >= 50 ? 'rgba(251, 191, 36, 0.2)' : 
                                                        'rgba(248, 113, 113, 0.2)',
                                        color: s.avgScore >= 80 ? '#4ade80' : 
                                               s.avgScore >= 50 ? '#fbbf24' : 
                                               '#f87171'
                                    }}>
                                        {s.avgScore}%
                                    </div>
                                </td>
                                <td className="sm-td-date">
                                    {new Date(s.lastActivity).toLocaleDateString('uk-UA')}
                                </td>
                                <td>
                                    <button className="sm-btn-view">Профіль →</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {error && (
                    <div className="sm-error-msg">⚠️ Помилка: {error}</div>
                )}
                {filteredStudents.length === 0 && !loading && !error && (
                    <div className="sm-empty">Студентів не знайдено</div>
                )}
            </div>
        </div>
    );
};

export default StudentManager;
