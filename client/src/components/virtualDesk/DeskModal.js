import React from 'react';

const DeskModal = ({ show, title, onClose, onConfirm, children }) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Скасувати</button>
          <button className="btn-confirm" onClick={onConfirm}>Підтвердити</button>
        </div>
      </div>
    </div>
  );
};

export default DeskModal;
