import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_URL, { getUserPlatform } from '../api';
import ConfirmModal from './ConfirmModal';
import './Settings.css';

const Settings = ({ user }) => {
    const [cities, setCities] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [selectedCity, setSelectedCity] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        type: '' // 'city' or 'student'
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const [citiesRes, studentsRes] = await Promise.all([
                axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`, config),
                axios.get(`${API_URL}/maintenance/students`, config)
            ]);
            setCities(citiesRes.data);
            setStudents(studentsRes.data);
        } catch (err) {
            console.error('Error fetching settings data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleResetCity = async () => {
        if (!selectedCity) return;
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.delete(`${API_URL}/maintenance/reset/city`, {
                ...config,
                data: { city: selectedCity }
            });
            alert(`Успішно видалено ${res.data.deletedCount} результатів для міста ${selectedCity}`);
            setSelectedCity('');
            fetchData();
        } catch (err) {
            alert('Помилка при скиданні результатів: ' + (err.response?.data?.error || err.message));
        } finally {
            setActionLoading(false);
            setModalConfig({ ...modalConfig, isOpen: false });
        }
    };

    const handleResetStudent = async (student) => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.delete(`${API_URL}/maintenance/reset/student`, {
                ...config,
                data: {
                    studentName: student.studentName,
                    studentLastName: student.studentLastName,
                    studentCity: student.studentCity
                }
            });
            alert(`Успішно видалено ${res.data.deletedCount} результатів для студента ${student.studentLastName} ${student.studentName}`);
            fetchData();
        } catch (err) {
            alert('Помилка при скиданні результатів: ' + (err.response?.data?.error || err.message));
        } finally {
            setActionLoading(false);
            setModalConfig({ ...modalConfig, isOpen: false });
        }
    };

    const handleResetAll = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const res = await axios.delete(`${API_URL}/maintenance/reset/all`, config);
            alert(`Успішно видалено абсолютно ВСІ результати (${res.data.deletedCount} записів). Система очищена.`);
            fetchData();
        } catch (err) {
            alert('Помилка при повному скиданні: ' + (err.response?.data?.error || err.message));
        } finally {
            setActionLoading(false);
            setModalConfig({ ...modalConfig, isOpen: false });
        }
    };

    const openCityModal = () => {
        if (!selectedCity) return;
        setModalConfig({
            isOpen: true,
            title: 'Скинути результати за містом',
            message: `Ви впевнені, що хочете видалити ВСІ результати для міста "${selectedCity}"? Цю дію неможливо скасувати.`,
            onConfirm: handleResetCity,
            type: 'city'
        });
    };

    const openStudentModal = (student) => {
        setModalConfig({
            isOpen: true,
            title: 'Скинути результати студента',
            message: `Ви впевнені, що хочете видалити ВСІ результати для студента ${student.studentLastName} ${student.studentName} (${student.studentCity || 'без міста'})?`,
            onConfirm: () => handleResetStudent(student),
            type: 'student'
        });
    };

    const openResetAllModal = () => {
        setModalConfig({
            isOpen: true,
            title: '⚠️ УВАГА: ПОВНЕ СКИНУТТЯ',
            message: 'Ви впевнені, що хочете видалити АБСОЛЮТНО ВСІ результати тестів у всій системі? Ця дія є незворотною та видалить дані про всіх студентів та всі проходження.',
            onConfirm: handleResetAll,
            type: 'all'
        });
    };

    const filteredStudents = students.filter(s => {
        const full = `${s.studentLastName} ${s.studentName} ${s.studentCity}`.toLowerCase();
        return full.includes(studentSearch.toLowerCase());
    });

    if (loading) return <div className="settings-loading">Завантаження налаштувань...</div>;

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>⚙️ Налаштування системи</h1>
                <p>Керування даними та технічне обслуговування</p>
            </div>

            <div className="settings-grid">
                {/* Секція скидання за містом */}
                <div className="settings-card">
                    <div className="settings-card-header">
                        <span className="card-icon">🏙️</span>
                        <h3>Скинути результати за містом</h3>
                    </div>
                    <div className="settings-card-body">
                        <p>Видаляє всі результати тестів, ігр та квізів для вибраного міста.</p>
                        <div className="settings-action-row">
                            <select 
                                value={selectedCity} 
                                onChange={e => setSelectedCity(e.target.value)}
                                className="settings-select"
                                disabled={actionLoading}
                            >
                                <option value="">Оберіть місто...</option>
                                {cities.map(c => (
                                    <option key={c._id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                            <button 
                                className="btn-danger" 
                                onClick={openCityModal}
                                disabled={!selectedCity || actionLoading}
                            >
                                {actionLoading ? '...' : 'Скинути'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Секція ПОВНОГО скидання (тільки для superadmin) */}
                {user?.role === 'superadmin' && (
                    <div className="settings-card danger-zone">
                        <div className="settings-card-header">
                            <span className="card-icon">⚠️</span>
                            <h3>Загальне скидання результатів</h3>
                        </div>
                        <div className="settings-card-body">
                            <p>Очистити абсолютно всі результати тестів, квізів та ігор у всій системі. Діє на всі міста та всіх студентів.</p>
                            <div className="settings-action-row">
                                <button 
                                    className="btn-danger-large" 
                                    onClick={openResetAllModal}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? 'Видалення...' : 'ВИДАЛИТИ ВСІ ДАНІ'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Секція скидання за студентом */}
                <div className="settings-card full-width">
                    <div className="settings-card-header">
                        <span className="card-icon">👤</span>
                        <h3>Скинути результати студента</h3>
                    </div>
                    <div className="settings-card-body">
                        <p>Видаляє всі результати для конкретної людини.</p>
                        <div className="settings-search">
                            <input 
                                type="text" 
                                placeholder="Пошук студента за прізвищем або містом..." 
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                className="settings-input"
                            />
                        </div>
                        <div className="settings-students-list">
                            {filteredStudents.length > 0 ? (
                                <table className="settings-table">
                                    <thead>
                                        <tr>
                                            <th>Прізвище та ім'я</th>
                                            <th>Місто</th>
                                            <th style={{ textAlign: 'right' }}>Дія</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map((s, idx) => (
                                            <tr key={`${s.studentName}-${s.studentLastName}-${idx}`}>
                                                <td>{s.studentLastName} {s.studentName}</td>
                                                <td>{s.studentCity || '—'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button 
                                                        className="btn-text-danger"
                                                        onClick={() => openStudentModal(s)}
                                                        disabled={actionLoading}
                                                    >
                                                        🗑️ Скинути
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="settings-empty">Студентів не знайдено</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmModal 
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                message={modalConfig.message}
                onConfirm={modalConfig.onConfirm}
                onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
                confirmText={actionLoading ? 'Видалення...' : 'Підтвердити видалення'}
            />
        </div>
    );
};

export default Settings;
