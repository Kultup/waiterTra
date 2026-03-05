import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        if (onClose && duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [onClose, duration]);

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return (
        <div className={`toast toast-${type}`}>
            <span className="toast-icon">{icons[type]}</span>
            <span className="toast-message">{message}</span>
        </div>
    );
};

export default Toast;
