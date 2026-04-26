import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Sun, Moon, ArrowLeft, CircleUserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';
import useThemeMode from '../hooks/useThemeMode';

const Navbar = ({
  variant = 'public',
  title = '',
  backTo = null,
  actions = null,
  compact = false,
}) => {
  const [showSignup, setShowSignup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();
  const { isDarkMode, setIsDarkMode } = useThemeMode();

  useEffect(() => {
    // Check if token is in URL (from verification page)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlRefreshToken = params.get('refresh_token');
    
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      if (urlRefreshToken) {
        localStorage.setItem('refresh_token', urlRefreshToken);
      }
      setIsAuthenticated(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Check if token is already in localStorage
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setProfileMenuOpen(false);
  };

  const openProfilePage = () => {
    setProfileMenuOpen(false);
    navigate('/profile');
  };

  const openLearningPage = () => {
    setProfileMenuOpen(false);
    navigate('/learning');
  };

  const openChatPage = () => {
    setProfileMenuOpen(false);
    navigate('/chat');
  };

  const handleStartCoding = () => {
    if (!isAuthenticated) {
      setShowLogin(true);
    } else {
      // User is authenticated, navigate to Chat page
      navigate('/chat');
    }
  };

  if (variant === 'app') {
    return (
      <header className={`sticky top-0 z-30 border-b backdrop-blur-lg transition-colors duration-300 ${
        isDarkMode ? 'bg-[#050505]/85 border-white/10' : 'bg-white/90 border-gray-200'
      }`}>
        <div className={`${compact ? 'w-full px-4' : 'max-w-7xl mx-auto px-6'} h-16 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-3 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                  isDarkMode ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-lg font-semibold leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {title || 'Lock-In'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isDarkMode
                  ? 'text-gray-400 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white hover:opacity-80 transition-all"
                title="Open profile menu"
              >
                <CircleUserRound className="w-5 h-5" />
              </button>

              {profileMenuOpen && (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50 transition-colors duration-300 ${
                  isDarkMode
                    ? 'bg-[#1a1a1a] border border-white/10'
                    : 'bg-white border border-gray-200'
                }`}>
                  <button
                    onClick={openProfilePage}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors rounded-t-lg ${
                      isDarkMode
                        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Profile
                  </button>
                  <button
                    onClick={openLearningPage}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors border-t ${
                      isDarkMode
                        ? 'text-gray-300 hover:bg-white/5 hover:text-white border-white/5'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-gray-200'
                    }`}
                  >
                    Learning Module
                  </button>
                  <button
                    onClick={openChatPage}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors rounded-b-lg border-t ${
                      isDarkMode
                        ? 'text-gray-300 hover:bg-white/5 hover:text-white border-white/5'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-gray-200'
                    }`}
                  >
                    Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Lock-In</span>
          </div>
          <div className="flex items-center gap-3">
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
                >
                  Login
                </button>

                <button
                  onClick={() => setShowSignup(true)}
                  className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
              >
                Logout
              </button>
            )}

            <button 
              onClick={handleStartCoding}
              className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-all"
            >
              Start Coding
            </button>
          </div>
        </div>
      </nav>
      {showSignup && <Signup onClose={() => setShowSignup(false)} onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }} />}
      {showLogin && <Login onClose={() => setShowLogin(false)} onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }} />}
    </>
  );
};

export default Navbar;