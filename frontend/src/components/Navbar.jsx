import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import Signup from './Signup';
import Login from './Login';

const Navbar = () => {
  const [showSignup, setShowSignup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if token is in URL (from verification page)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setIsAuthenticated(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Check if token is already in localStorage
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

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
              onClick={() => {
                if (!isAuthenticated) {
                  setShowLogin(true);
                } else {
                  // User is authenticated, proceed with coding
                  // You can add navigation or other logic here
                  console.log('User is authenticated, proceeding...');
                }
              }}
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