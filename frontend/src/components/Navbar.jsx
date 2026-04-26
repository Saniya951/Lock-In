import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Sun, Moon, ArrowLeft, CircleUserRound, Github } from 'lucide-react';
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
  const [isGithubConnected, setIsGithubConnected] = useState(!!localStorage.getItem('github_token'));
  const navigate = useNavigate();
  const { isDarkMode, setIsDarkMode } = useThemeMode();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlRefreshToken = params.get('refresh_token');

    if (urlToken) {
      localStorage.setItem('token', urlToken);
      if (urlRefreshToken) {
        localStorage.setItem('refresh_token', urlRefreshToken);
      }
      setIsAuthenticated(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const githubTokenFromUrl = params.get('github_token');
    if (githubTokenFromUrl) {
      console.log("✅ GitHub token found in URL, saving and closing...");
      localStorage.setItem('github_token', githubTokenFromUrl);

      if (window.opener || window.name === "GitHub Login") {
        window.close();
      }

      setIsGithubConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const handleStorageChange = (e) => {
      if (e.key === 'github_token' && e.newValue) {
        console.log("🚀 Storage event detected! GitHub connected.");
        setIsGithubConnected(true);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
    setIsGithubConnected(!!localStorage.getItem('github_token'));

    return () => window.removeEventListener('storage', handleStorageChange);
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

  const handleConnectGithub = () => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "http://localhost:8000/github/login",
      "GitHub Login",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('github_token');
    setIsAuthenticated(false);
    setIsGithubConnected(false);
    setProfileMenuOpen(false);
    navigate('/');
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
    if (!isAuthenticated) setShowLogin(true);
    else navigate('/chat');
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
                  <button
                    onClick={handleLogout}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors rounded-b-lg border-t ${
                      isDarkMode
                        ? 'text-red-400 hover:bg-white/5 hover:text-red-300 border-white/5'
                        : 'text-red-600 hover:bg-gray-100 hover:text-red-700 border-gray-200'
                    }`}
                  >
                    Logout
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
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Lock-In</span>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <button
                onClick={handleConnectGithub}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                  isGithubConnected
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-[#24292e] text-white hover:bg-black'
                }`}
              >
                <Github className="w-4 h-4" />
                {isGithubConnected ? 'GitHub Connected' : 'Connect GitHub'}
              </button>
            )}

            {!isAuthenticated ? (
              <>
                <button onClick={() => setShowLogin(true)} className="px-5 py-2.5 text-white text-sm hover:opacity-70 transition-all">Login</button>
                <button onClick={() => setShowSignup(true)} className="px-5 py-2.5 text-white text-sm hover:opacity-70 transition-all">Sign Up</button>
              </>
            ) : (
              <button onClick={handleLogout} className="px-5 py-2.5 text-white text-sm hover:opacity-70 transition-all">Logout</button>
            )}

            <button onClick={handleStartCoding} className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-all">
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