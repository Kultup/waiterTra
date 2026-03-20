import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, user }) => {
  // Основне меню
  const mainMenu = [
    { id: 'dashboard', label: 'Панель', icon: '📊', roles: ['superadmin', 'admin', 'trainer', 'viewer'] },
    { id: 'test-results', label: 'Результати', icon: '✅', roles: ['superadmin', 'admin', 'trainer', 'viewer'] },
    { id: 'students', label: 'Студенти', icon: '👥', roles: ['superadmin', 'admin'] },
    { id: 'analytics', label: 'Аналітика', icon: '📈', roles: ['localadmin'] },
  ];

  // Створення тестів (тільки для адмінів та тренерів)
  const createMenu = [
    { id: 'virtual-desk', label: 'Сервірування', icon: '🖥️', roles: ['superadmin', 'admin'] },
    { id: 'quiz-builder', label: 'Квіз (Тести)', icon: '📝', roles: ['superadmin', 'admin', 'trainer'] },
    { id: 'visual-builder', label: 'Візуальний редактор', icon: '🗺️', roles: ['superadmin', 'admin', 'trainer'] },
    { id: 'complex-builder', label: 'Комплексний тест', icon: '🧩', roles: ['superadmin', 'admin'] },
  ];

  // Управління (тільки superadmin та admin)
  const adminMenu = [
    { id: 'users', label: 'Користувачі', icon: '👥', roles: ['superadmin'] },
    { id: 'cities', label: 'Міста', icon: '🏙️', roles: ['superadmin'] },
    { id: 'dishes', label: 'Посуд', icon: '🍽️', roles: ['superadmin', 'admin'] },
    { id: 'settings', label: 'Налаштування', icon: '⚙️', roles: ['superadmin', 'admin'] },
  ];

  const filterByRole = (items) => items.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        {user?.platform === 'funadmin'
          ? <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', padding: '0.5rem 0' }}>🎮 FunAdmin</div>
          : <img src="/km-logo.png" alt="Країна Мрій" className="sidebar-logo-img" />
        }
        <button className="mobile-close" onClick={() => setIsOpen(false)}>×</button>
      </div>
      
      <nav className="sidebar-nav">
        {/* Основне меню */}
        {filterByRole(mainMenu).map((item) => (
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

        {/* Розділ "Створення тестів" */}
        {filterByRole(createMenu).length > 0 && (
          <>
            <div className="nav-section-title">Створення тестів</div>
            {filterByRole(createMenu).map((item) => (
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
          </>
        )}

        {/* Розділ "Управління" */}
        {filterByRole(adminMenu).length > 0 && (
          <>
            <div className="nav-section-title">Управління</div>
            {filterByRole(adminMenu).map((item) => (
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
          </>
        )}
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
