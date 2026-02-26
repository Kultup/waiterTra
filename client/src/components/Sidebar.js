import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Панель', icon: '📊' },
    { id: 'virtual-desk', label: 'Віртуальний стіл', icon: '🖥️' },
    { id: 'game-builder', label: 'Гра (Choice)', icon: '🎮' },
    { id: 'test-results', label: 'Результати', icon: '📝' },
    { id: 'settings', label: 'Налаштування', icon: '⚙️' },
  ];

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h2>ServIQ</h2>
        <button className="mobile-close" onClick={() => setIsOpen(false)}>×</button>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(item.id);
              if (window.innerWidth <= 768) setIsOpen(false);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">AD</div>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <span className="user-role">Administrator</span>
          </div>
        </div>
        <button className="btn-logout" onClick={onLogout} title="Вийти">
          ↪ Вийти
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
