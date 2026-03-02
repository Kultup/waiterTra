import React from 'react';
import './InactiveTest.css';

const InactiveTest = () => {
    return (
        <div className="inactive-container">
            <div className="inactive-card">
                <div className="inactive-icon">🔒</div>
                <h2>Тест неактивний</h2>
                <p>Це посилання більше не діє. Можливо, ви вже пройшли цей тест або доступ до нього було обмежено адміністратором.</p>
                <div className="inactive-info">
                    Якщо ви вважаєте, що це помилка, зверніться до вашого адміністратора.
                </div>
            </div>
            <div className="inactive-footer">
                &copy; {new Date().getFullYear()} ServIQ — Платформа для навчання
            </div>
        </div>
    );
};

export default InactiveTest;
