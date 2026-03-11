import React from 'react';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Видалити', cancelText = 'Скасувати' }) => {
    if (!isOpen) return null;

    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal-content">
                <div className="confirm-modal-header">
                    <h3>{title || 'Підтвердження діі'}</h3>
                    <button className="confirm-modal-close" onClick={onCancel} title="Закрити">
                        &times;
                    </button>
                </div>
                <div className="confirm-modal-body">
                    <p>{message || 'Ви впевнені, що хочете виконати цю дію?'}</p>
                </div>
                <div className="confirm-modal-footer">
                    <button className="confirm-btn-cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className="confirm-btn-danger" onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
