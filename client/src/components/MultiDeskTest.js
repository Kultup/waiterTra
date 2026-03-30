import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './VirtualDesk.css';
import './MultiDeskTest.css';
import API_URL from '../api';
import DeskEngine from './DeskEngine';

const MultiDeskTest = () => {
    const { hash } = useParams();
    const navigate = useNavigate();
    const [testData, setTestData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isRegistered, setIsRegistered] = useState(false);
    const [studentInfo, setStudentInfo] = useState({ firstName: '', lastName: '', city: '', position: '' });

    const [currentStep, setCurrentStep] = useState(0);
    const [dishes, setDishes] = useState([]);
    const [stepResults, setStepResults] = useState([]);
    const [currentStepResult, setCurrentStepResult] = useState(null);
    const [catalogDishes, setCatalogDishes] = useState([]);

    const [showSummary, setShowSummary] = useState(false);
    const [serverResults, setServerResults] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [testRes, dishesRes] = await Promise.all([
                    axios.get(`${API_URL}/tests/multi/${hash}`),
                    axios.get(`${API_URL}/dishes`)
                ]);
                setTestData(testRes.data);
                if (testRes.data.city) {
                    setStudentInfo(prev => ({ ...prev, city: testRes.data.city }));
                }
                setCatalogDishes(dishesRes.data.map(d => ({ ...d, id: d._id })));
            } catch (err) {
                console.error('Error fetching multi-test data:', err);
                if (err.response?.status === 410) navigate('/inactive');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [hash, navigate]);

    const templates = testData?.templateIds || [];
    const currentTemplate = templates[currentStep];

    useEffect(() => {
        if (!currentTemplate) return;

        const allowedItems = currentTemplate.allowedItems || [];
        if (allowedItems.length > 0) {
            setDishes(allowedItems.map((item) => ({
                ...item,
                _id: item.id || item.type,
                id: item.id || item.type,
            })));
            return;
        }

        setDishes(catalogDishes);
    }, [currentTemplate, catalogDishes]);

    useEffect(() => {
        setCurrentStepResult(null);
    }, [currentStep]);

    const handleRegister = (e) => {
        e.preventDefault();
        if (studentInfo.firstName && studentInfo.lastName && studentInfo.position) {
            setIsRegistered(true);
        } else {
            alert('Будь ласка, заповніть усі поля');
        }
    };

    const handleDeskSubmit = async (items) => {
        const res = await axios.post(`${API_URL}/tests/multi/${hash}/check-step`, {
            stepIndex: currentStep, items
        });
        const { score, total, percentage, passed, validatedItems, ghostItems } = res.data;
        return { score, total, percentage, passed, validatedItems, ghostItems: ghostItems || [] };
    };

    const handleDeskResult = (result) => {
        setCurrentStepResult(result);
    };

    const handleNext = async () => {
        if (!currentStepResult) return;
        const newResults = [...stepResults, currentStepResult];
        setStepResults(newResults);

        if (currentStep < templates.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            try {
                const res = await axios.post(`${API_URL}/tests/multi/${hash}/submit`, {
                    studentName: studentInfo.firstName,
                    studentLastName: studentInfo.lastName,
                    studentCity: studentInfo.city,
                    studentPosition: studentInfo.position,
                    results: newResults.map((result) => ({ items: result?.submittedItems || [] }))
                });
                setServerResults(res.data.stepResults);
            } catch (e) {
                console.error('Submit error:', e);
            }
            setShowSummary(true);
        }
    };

    const nextLabel = currentStep < templates.length - 1 ? 'Далі \u2192' : 'Завершити';
    const nextButton = (
        <button className="btn-save-template" onClick={handleNext}>{nextLabel}</button>
    );

    if (loading) return <div className="placeholder-view">Завантаження тесту...</div>;
    if (!testData) return <div className="placeholder-view">Тест не знайдено</div>;

    if (!isRegistered) {
        return (
            <div className="registration-container">
                <div className="registration-card">
                    <h2>Комплексний тест сервірування</h2>
                    <p>Всього сервіровок: <strong>{templates.length}</strong></p>
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label>Ім'я</label>
                            <input type="text" value={studentInfo.firstName}
                                onChange={e => setStudentInfo({ ...studentInfo, firstName: e.target.value })}
                                placeholder="Введіть ім'я" required />
                        </div>
                        <div className="form-group">
                            <label>Прізвище</label>
                            <input type="text" value={studentInfo.lastName}
                                onChange={e => setStudentInfo({ ...studentInfo, lastName: e.target.value })}
                                placeholder="Введіть прізвище" required />
                        </div>
                        <div className="form-group">
                            <label>Місто</label>
                            <input type="text" value={studentInfo.city || '—'} disabled
                                style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '1rem', opacity: 0.7, cursor: 'not-allowed' }} />
                        </div>
                        <div className="form-group">
                            <label>Посада</label>
                            <input type="text" value={studentInfo.position}
                                onChange={e => setStudentInfo({ ...studentInfo, position: e.target.value })}
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

    if (showSummary) {
        const results = serverResults || stepResults;
        const totalScore = results.reduce((s, r) => s + (r?.score || 0), 0);
        const totalMax = results.reduce((s, r) => s + (r?.total || 0), 0);
        const overallPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
        const allPassed = results.every(r => r?.passed);

        return (
            <div className="multi-desk-container">
                <div className="multi-summary">
                    <h2>Зведений результат</h2>
                    <table className="summary-table">
                        <thead>
                            <tr><th>Сервіровка</th><th>Бали</th><th>%</th><th>Статус</th></tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={i} className={r?.passed ? 'passed-row' : 'failed-row'}>
                                    <td>{r?.templateName || templates[i]?.name || `#${i + 1}`}</td>
                                    <td>{r?.score}/{r?.total}</td>
                                    <td>{r?.percentage}%</td>
                                    <td>{r?.passed ? '✅' : '❌'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="overall-result">
                        <div className="overall-score" style={{ color: allPassed ? '#4ade80' : '#f87171' }}>
                            {overallPercent}%
                        </div>
                        <p className="overall-status">
                            {allPassed ? '✅ Всі сервіровки пройдено!' : '❌ Деякі сервіровки не пройдено'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="multi-desk-container">
            <div className="stepper">
                {templates.map((t, i) => (
                    <div key={i} className="stepper-step">
                        <div className={`step-circle ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                            {i < currentStep ? '✓' : i + 1}
                        </div>
                        {i < templates.length - 1 && (
                            <div className={`step-line ${i < currentStep ? 'done' : ''}`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="step-header">
                <h2>{currentTemplate?.name}</h2>
                <p>{studentInfo.firstName} {studentInfo.lastName} · Крок {currentStep + 1} з {templates.length}</p>
            </div>

            <DeskEngine
                key={`desk-${currentStep}`}
                dishes={dishes}
                underlays={currentTemplate?.underlays || currentTemplate?.templateSnapshot?.underlays || []}
                description={currentTemplate?.description}
                timeLimit={currentTemplate?.timeLimit || 0}
                deskSurfacePreset={currentTemplate?.deskSurfacePreset || currentTemplate?.templateSnapshot?.deskSurfacePreset || 'walnut'}
                deskSurfaceColor={currentTemplate?.deskSurfaceColor || currentTemplate?.templateSnapshot?.deskSurfaceColor || '#ffffff'}
                onSubmit={handleDeskSubmit}
                onResult={handleDeskResult}
                embedded
                nextButton={nextButton}
            />
        </div>
    );
};

export default MultiDeskTest;
