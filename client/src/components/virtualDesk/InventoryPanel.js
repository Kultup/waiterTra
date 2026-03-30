import React from 'react';
import API_URL from '../../api';

const normalizeRotation = (value) => ((value % 360) + 360) % 360;

const renderDishIcon = (dish) => {
  if (!dish?.icon) return '🍽️';

  const isImage = dish.icon.startsWith('http') || dish.icon.startsWith('/uploads');
  if (!isImage) {
    return (
      <span style={{ display: 'inline-flex', transform: `rotate(${normalizeRotation(dish.rotation || 0)}deg)` }}>
        {dish.icon}
      </span>
    );
  }

  const src = dish.icon.startsWith('http') ? dish.icon : `${API_URL.replace('/api', '')}${dish.icon}`;
  return (
    <img
      src={src}
      alt={dish.name}
      className="inv-icon-image"
      style={{ transform: `rotate(${normalizeRotation(dish.rotation || 0)}deg)` }}
    />
  );
};

const InventoryPanel = ({ dishes, selectedDish, onSelectDish }) => (
  <aside className="desk-panel inventory-panel">
    <div className="panel-label">Посуд</div>
    <div className="inventory-grid">
      {dishes.length === 0 ? (
        <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888', padding: '20px 0' }}>
          Товарів немає. Додайте їх у меню "Посуд".
        </p>
      ) : (
        dishes.map((dish) => (
          <div
            key={dish._id}
            className={`inv-item ${selectedDish?._id === dish._id ? 'active' : ''}`}
            onClick={() => onSelectDish(dish)}
            title={dish.name}
          >
            <span className="inv-icon">{renderDishIcon(dish)}</span>
            <span className="inv-name">{dish.name}</span>
          </div>
        ))
      )}
    </div>
  </aside>
);

export default InventoryPanel;
