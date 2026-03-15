'use client';

import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'
import Header from './components/Header'
import LandingPage from './pages/LandingPage'
import SignIn from './pages/SignIn'
import CreateAccount from './pages/CreateAccount'
import Dashboard from './pages/Dashboard'
import ETLDashboard from './pages/ETLDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import ErrorBoundary from './components/ErrorBoundary'

/**
 * Main App Component
 * Handles routing for OneStopAnalytics application
 * Routes: Landing, SignIn, CreateAccount, Dashboard with protected navigation
 */
function App() {
  // Track user authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  )
  const [userName, setUserName] = useState(
    localStorage.getItem('userName') || ''
  )
  const [userId, setUserId] = useState(
    localStorage.getItem('userId') || null
  )

  /**
   * Handle user login
   * Stores authentication state in localStorage
   * @param {string} name - User's display name
   */
  const handleLogin = (name, id) => {
    setIsAuthenticated(true)
    setUserName(name)
    setUserId(id)
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('userName', name)
    localStorage.setItem('userId', id)
  }

  /**
   * Handle user logout
   * Clears authentication state
   */
  const handleLogout = () => {
    setIsAuthenticated(false)
    setUserName('')
    setUserId(null)
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('userName')
    localStorage.removeItem('userId')
  }

  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('theme') === 'dark' || false
  )

  /**
   * Toggle between light and dark theme
   */
  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    localStorage.setItem('theme', newTheme ? 'dark' : 'white')
  }

  return (
    <div className={`app-container ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
      <ErrorBoundary>
        <Router>
          <Header
            isAuthenticated={isAuthenticated}
            userName={userName}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
          <Routes>
            <Route path="/" element={<LandingPage userId={userId} isDarkMode={isDarkMode} toggleTheme={toggleTheme} onLogin={handleLogin} />} />
            <Route
              path="/sign-in"
              element={<SignIn isAuthenticated={isAuthenticated} onLogin={handleLogin} />}
            />
            <Route
              path="/create-account"
              element={<CreateAccount isAuthenticated={isAuthenticated} onLogin={handleLogin} />}
            />
            {/* Keep old /auth route for backward compatibility - redirect to sign-in */}
            <Route
              path="/auth"
              element={<SignIn isAuthenticated={isAuthenticated} onLogin={handleLogin} />}
            />
            <Route
              path="/dashboard"
              element={
                isAuthenticated ? (
                  <Dashboard userName={userName} userId={userId} />
                ) : (
                  <LandingPage userId={userId} isDarkMode={isDarkMode} toggleTheme={toggleTheme} onLogin={handleLogin} />
                )
              }
            />
            <Route
              path="/etl"
              element={
                isAuthenticated ? (
                  <ETLDashboard />
                ) : (
                  <LandingPage userId={userId} isDarkMode={isDarkMode} toggleTheme={toggleTheme} onLogin={handleLogin} />
                )
              }
            />
            <Route
              path="/analytics/:fileId"
              element={
                isAuthenticated ? (
                  <AnalyticsDashboard />
                ) : (
                  <LandingPage userId={userId} isDarkMode={isDarkMode} toggleTheme={toggleTheme} onLogin={handleLogin} />
                )
              }
            />
          </Routes>
        </Router>
      </ErrorBoundary>
    </div>
  )
}

export default App;
