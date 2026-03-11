import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar.js';
import Dashboard from './components/Dashboard.js';
import VirtualDesk from './components/VirtualDesk.js';
import StudentTest from './components/StudentTest.js';
import TestResults from './components/TestResults.js';
import VisualGameBuilder from './components/VisualGameBuilder.js';
import QuizBuilder from './components/QuizBuilder.js';
import QuizPlay from './components/QuizPlay.js';
import UserManager from './components/UserManager.js';
import MultiDeskTest from './components/MultiDeskTest.js';
import ComplexTestBuilder from './components/ComplexTestBuilder.js';
import ComplexTestPlay from './components/ComplexTestPlay.js';
import InactiveTest from './components/InactiveTest.js';
import CityManagement from './components/CityManagement.js';
import Login from './components/Login.js';
import GamePlay from './components/GamePlay.js';
import Analytics from './components/Analytics.js';
import DishManagement from './components/DishManagement.js';

function AdminPanel({ onLogout, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pathTab = location.pathname.split('/')[1] || 'dashboard';
  const activeTab = user?.role === 'localadmin' ? 'analytics' : pathTab;

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
        user={user}
      />
      <main className="admin-main">
        <Routes>
          {/* localadmin бачить тільки аналітику */}
          {user?.role === 'localadmin' ? (
            <>
              <Route index element={<Analytics user={user} />} />
              <Route path="analytics" element={<Analytics user={user} />} />
              <Route path="*" element={<Analytics user={user} />} />
            </>
          ) : (
            <>
              <Route index element={<Dashboard user={user} />} />
              <Route path="dashboard" element={<Dashboard user={user} />} />
              <Route path="analytics" element={user?.role === 'localadmin' ? <Analytics user={user} /> : <Dashboard user={user} />} />
              <Route path="users" element={user?.role === 'superadmin' ? <UserManager /> : <Dashboard user={user} />} />
              <Route path="cities" element={user?.role === 'superadmin' ? <CityManagement /> : <Dashboard user={user} />} />
              <Route path="dishes" element={['superadmin', 'admin'].includes(user?.role) ? <DishManagement /> : <Dashboard user={user} />} />
              <Route path="virtual-desk" element={['superadmin', 'admin'].includes(user?.role) ? <VirtualDesk /> : <Dashboard user={user} />} />
              <Route path="test-results" element={<TestResults user={user} />} />
              <Route path="visual-builder" element={['superadmin', 'admin', 'trainer'].includes(user?.role) ? <VisualGameBuilder /> : <Dashboard user={user} />} />
              <Route path="quiz-builder" element={['superadmin', 'admin', 'trainer'].includes(user?.role) ? <QuizBuilder /> : <Dashboard user={user} />} />
              <Route path="complex-builder" element={['superadmin', 'admin'].includes(user?.role) ? <ComplexTestBuilder /> : <Dashboard user={user} />} />
              <Route path="settings" element={<div className="placeholder-view"><h2>Налаштування системи</h2><p>Цей розділ в розробці...</p></div>} />
              <Route path="*" element={<Dashboard user={user} />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('token')
  );
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (token, userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <ToastProvider>
        <Routes>
          <Route path="/test/:hash" element={<StudentTest />} />
          <Route path="/game/:hash" element={<GamePlay />} />
          <Route path="/quiz/:hash" element={<QuizPlay />} />
          <Route path="/multi-test/:hash" element={<MultiDeskTest />} />
          <Route path="/complex/:hash" element={<ComplexTestPlay />} />
          <Route path="/inactive" element={<InactiveTest />} />
          <Route
            path="/*"
            element={
              isAuthenticated
                ? <AdminPanel onLogout={handleLogout} user={user} />
                : <Login onLogin={handleLogin} />
            }
          />
        </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;

