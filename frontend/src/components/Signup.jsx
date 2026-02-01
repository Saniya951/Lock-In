import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

const Signup = ({ onClose, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Verification email sent! Check your inbox.');
      } else {
        setMessage(data.detail || 'Signup failed');
      }
    } catch (error) {
      setMessage('Error occurred');
    }
  };

  return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="relative bg-[#0b0b0b] border border-white/10 rounded-xl p-10 w-full max-w-md shadow-xl">
  
          {/* Logo */}
          <div className="w-14 h-14 mx-auto mb-4 bg-black/30 backdrop-blur-sm rounded-2xl border border-white/10 flex items-center justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
          </div>
  
          {/* Headings */}
          <h1 className="text-white text-3xl font-bold text-center mb-2">
            Welcome To Lock-In
          </h1>
          <p className="text-white/60 text-center mb-10">
            Already have an account?
  
            <button
              onClick={onSwitchToLogin}
              className="text-indigo-400 hover:text-indigo-300 font-semibold ml-1"
            >
              Log In
            </button>
          </p>
  
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
  
            {/* Email */}
            <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 9.75 12 12.75 7.5 9.75"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.5 18h15a1.5 1.5 0 0 0 1.5-1.5v-9a1.5 1.5 0 0 0-1.5-1.5h-15A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18Z"
                />
              </svg>
  
              <input
                type="email"
                placeholder="email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
              />
            </div>
  
            {/* Password */}
            <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16.5 10.5V7.5A4.5 4.5 0 0 0 12 3a4.5 4.5 0 0 0-4.5 4.5v3"
                />
                <rect
                  x="6"
                  y="10.5"
                  width="12"
                  height="10.5"
                  rx="2"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
  
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
              />
            </div>
  
            {/* Login button */}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
            >
              SignUp
            </button>
          </form>
  
          {message && (
            <p className="text-center text-white mt-6">{message}</p>
          )}
  
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white/70 hover:text-white text-xl transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    );
};

export default Signup;