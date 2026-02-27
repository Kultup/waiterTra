import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, user }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Панель', icon: '📊', roles: ['superadmin', 'admin', 'trainer', 'viewer'] },
    { id: 'users', label: 'Користувачі', icon: '👥', roles: ['superadmin'] },
    { id: 'virtual-desk', label: 'Віртуальний стіл', icon: '🖥️', roles: ['superadmin', 'admin'] },
    { id: 'game-builder', label: 'Гра (Choice)', icon: '🎮', roles: ['superadmin', 'admin'] },
    { id: 'visual-builder', label: 'Візуальний редактор', icon: '🗺️', roles: ['superadmin', 'admin', 'trainer'] },
    { id: 'quiz-builder', label: 'Квіз (Тести)', icon: '📝', roles: ['superadmin', 'admin', 'trainer'] },
    { id: 'complex-builder', label: 'Комплексний тест', icon: '🧩', roles: ['superadmin', 'admin'] },
    { id: 'test-results', label: 'Результати', icon: '✅', roles: ['superadmin', 'admin', 'trainer', 'viewer'] },
    { id: 'settings', label: 'Налаштування', icon: '⚙️', roles: ['superadmin'] },
  ];

  const filteredItems = menuItems.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h2>ServIQ</h2>
        <button className="mobile-close" onClick={() => setIsOpen(false)}>×</button>
      </div>
      <nav className="sidebar-nav">
        {filteredItems.map((item) => (
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
          <div className="user-avatar">{user?.username?.substring(0, 2).toUpperCase() || '??'}</div>
          <div className="user-info">
            <span className="user-name">{user?.username || 'Гість'}</span>
            <span className="user-role">{user?.role || 'user'}</span>
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
