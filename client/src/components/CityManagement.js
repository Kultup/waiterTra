import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../api';
import './CityManagement.css';

const CityManagement = () => {
    const [cities, setCities] = useState([]);
    const [newCityName, setNewCityName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities`);
            setCities(res.data);
            setLoading(false);
        } catch (err) {
            setError('Не вдалося завантажити список міст');
            setLoading(false);
        }
    };

    const handleAddCity = async (e) => {
        e.preventDefault();
        if (!newCityName.trim()) return;
        setSaving(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/cities`, { name: newCityName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCities(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setNewCityName('');
        } catch (err) {
            setError(err.response?.data?.error || 'Помилка при додаванні міста');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCity = async (id) => {
        if (!window.confirm('Ви впевнені, що хочете видалити це місто?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/cities/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCities(prev => prev.filter(c => c._id !== id));
        } catch (err) {
            setError('Не вдалося видалити місто');
        }
    };

    if (loading) return <div className="placeholder-view">Завантаження...</div>;

    return (
        <div className="city-management-container">
            <header className="city-header">
                <h2>🏙️ Управління містами</h2>
                <p>Додайте міста, які будуть доступні у випадаючих списках по всій системі.</p>
            </header>

            {error && <div className="error-message">{error}</div>}

            <section className="add-city-section">
                <form onSubmit={handleAddCity} className="add-city-form">
                    <input
                        type="text"
                        placeholder="Назва міста (напр. Хмельницький)"
                        value={newCityName}
                        onChange={(e) => setNewCityName(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn-save-template" disabled={saving}>
                        {saving ? 'Додавання...' : '+ Додати місто'}
                    </button>
                </form>
            </section>

            <section className="cities-list-section">
                <h3>Список міст ({cities.length})</h3>
                <div className="cities-grid">
                    {cities.length === 0 ? (
                        <p className="empty-msg">Міст ще не додано</p>
                    ) : (
                        cities.map(city => (
                            <div key={city._id} className="city-card">
                                <span className="city-name">{city.name}</span>
                                <button
                                    className="btn-delete-city"
                                    onClick={() => handleDeleteCity(city._id)}
                                    title="Видалити"
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default CityManagement;
