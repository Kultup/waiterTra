import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar.js';
import Dashboard from './components/Dashboard.js';
import VirtualDesk from './components/VirtualDesk.js';
import StudentTest from './components/StudentTest.js';
import TestResults from './components/TestResults.js';
import GameBuilder from './components/GameBuilder.js';
import GamePlay from './components/GamePlay.js';
import Login from './components/Login.js';

function AdminPanel({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeTab = location.pathname.split('/')[1] || 'dashboard';

  return (
    <div className="admin-container">
      <button className="mobile-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => navigate(`/${tab === 'dashboard' ? '' : tab}`)}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onLogout={onLogout}
      />
      <main className="admin-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="virtual-desk" element={<VirtualDesk />} />
          <Route path="test-results" element={<TestResults />} />
          <Route path="game-builder" element={<GameBuilder />} />
          <Route path="settings" element={<div className="placeholder-view"><h2>Налаштування системи</h2><p>Цей розділ в розробці...</p></div>} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('admin_token')
  );

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/test/:hash" element={<StudentTest />} />
        <Route path="/game/:hash" element={<GamePlay />} />
        <Route
          path="/*"
          element={
            isAuthenticated
              ? <AdminPanel onLogout={handleLogout} />
              : <Login onLogin={handleLogin} />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

