import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './VirtualDesk.css';
import API_URL from '../api';
import DeskEngine from './DeskEngine';

const StudentTest = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [testData, setTestData] = useState(null);
    const [catalogDishes, setCatalogDishes] = useState([]);
    const [dishes, setDishes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Registration State
    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({
        firstName: '', lastName: '', city: '', position: ''
    });
    const [testResult, setTestResult] = useState(null);

    const [availableCities, setAvailableCities] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [citiesRes, dishesRes] = await Promise.all([
                    axios.get(`${API_URL}/cities`),
                    axios.get(`${API_URL}/dishes`)
                ]);
                setAvailableCities(citiesRes.data);
                const mappedDishes = dishesRes.data.map(d => ({ ...d, id: d._id }));
                setCatalogDishes(mappedDishes);
            } catch (error) {
                console.error('Error fetching initial data:', error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!testData) return;

        const allowedItems = testData.templateId?.allowedItems || [];
        if (allowedItems.length > 0) {
            setDishes(allowedItems.map((item) => ({
                ...item,
                _id: item.id || item.type,
                id: item.id || item.type,
            })));
            return;
        }

        setDishes(catalogDishes);
    }, [testData, catalogDishes]);

    useEffect(() => {
        const fetchTest = async () => {
            try {
                const response = await axios.get(`${API_URL}/tests/${hash}`);
                setTestData(response.data);
                if (response.data.city) {
                    setStudentInfo(prev => ({ ...prev, city: response.data.city }));
                }
            } catch (error) {
                console.error('Error fetching test:', error);
                if (error.response?.status === 410) navigate('/inactive');
            } finally {
                setLoading(false);
            }
        };
        fetchTest();
    }, [hash, navigate]);

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    const handleDeskSubmit = async (items) => {
        const payload = {
            items,
            studentName: studentInfo.firstName,
            studentLastName: studentInfo.lastName,
            studentCity: studentInfo.city,
            studentPosition: studentInfo.position,
        };
        const response = await axios.post(`${API_URL}/tests/${hash}/submit`, payload);
        const { score, total, percentage, passed, validatedItems, ghostItems } = response.data;
        return { score, total, percentage, passed, validatedItems, ghostItems: ghostItems || [] };
    };

    const handleDeskResult = (result) => {
        setTestResult(result);
    };

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>Реєстрація на тест</h2>
                    <p>Шаблон: <strong>{testData.templateId.name}</strong></p>
                    {(testData.description || testData.templateId?.description) && (
                        <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', margin: '0.5rem 0', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                            📋 <strong>Завдання:</strong> {testData.description || testData.templateId.description}
                        </div>
                    )}
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label>Ім'я</label>
                            <input type="text" value={studentInfo.firstName}
                                onChange={(e) => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                                placeholder="Введіть ім'я" required />
                        </div>
                        <div className="form-group">
                            <label>Прізвище</label>
                            <input type="text" value={studentInfo.lastName}
                                onChange={(e) => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                                placeholder="Введіть прізвище" required />
                        </div>
                        <div className="form-group">
                            <label>Місто</label>
                            {testData.city ? (
                                <input type="text" value={studentInfo.city} disabled className="form-control-disabled" />
                            ) : (
                                <select value={studentInfo.city}
                                    onChange={(e) => setStudentInfo({ ...studentInfo, city: e.target.value })}
                                    required className="form-control">
                                    <option value="">Оберіть місто...</option>
                                    {availableCities.map(city => (
                                        <option key={city._id} value={city.name}>{city.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Посада</label>
                            <input type="text" value={studentInfo.position}
                                onChange={(e) => setStudentInfo({ ...studentInfo, position: e.target.value })}
                                placeholder="Введіть посаду" required />
                        </div>
                        <button type="submit" className="btn-save-template" style={{ width: '100%', marginTop: '1rem' }}>
                            Почати тест
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                <h1>🍽️ {testData.templateId.name}</h1>
                <p>{studentInfo.firstName} {studentInfo.lastName} · {studentInfo.city} ({studentInfo.position})</p>
            </div>
            <DeskEngine
                dishes={dishes}
                underlays={testData.templateId?.underlays || testData.templateId?.templateSnapshot?.underlays || []}
                description={testData.description || testData.templateId?.description}
                timeLimit={testData.templateId?.timeLimit || 0}
                deskSurfacePreset={testData.templateId?.deskSurfacePreset || 'walnut'}
                deskSurfaceColor={testData.templateId?.deskSurfaceColor || '#ffffff'}
                onSubmit={handleDeskSubmit}
                onResult={handleDeskResult}
            />
            {testResult && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    Адміністратор отримав ваші результати
                </div>
            )}
        </div>
    );
};

export default StudentTest;
