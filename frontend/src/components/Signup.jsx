import React, { useState } from 'react';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

const Signup = ({ onClose, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const professionOptions = [
    'Student',
    'Developer',
    'Educator',
    'Designer',
    'Product Manager',
    'Entrepreneur',
    'Analyst',
    'Consultant',
    'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalProfession = profession === 'Other' ? customProfession : profession;
    try {
      const response = await fetch('http://localhost:8000/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password,
          first_name: firstName,
          last_name: lastName,
          dob,
          profession: finalProfession
        }),
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="relative bg-[#0b0b0b] border border-white/10 rounded-xl p-10 w-full max-w-2xl shadow-xl my-8">
  
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
          <form onSubmit={handleSubmit} className="space-y-4">
  
            {/* First Row: First Name and Last Name */}
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white/40 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
    
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
                />
              </div>

              {/* Last Name */}
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white/40 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
    
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Second Row: Date of Birth and Profession */}
            <div className="grid grid-cols-2 gap-4">
              {/* Date of Birth */}
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white/40 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                  />
                </svg>
    
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  className="bg-transparent w-full text-white/40 placeholder-white/40 focus:outline-none focus:text-white"
                />
              </div>

              {/* Profession */}
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white/40 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"
                  />
                </svg>
    
                <select
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  required
                  className="bg-transparent w-full text-white/40 placeholder-white/40 focus:outline-none focus:text-white"
                >
                  <option value="" disabled className="bg-[#222] text-white/50">Select Profession</option>
                  {professionOptions.map((prof) => (
                    <option key={prof} value={prof} className="bg-[#1a1a1a] text-white">
                      {prof}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Profession Input (shows if "Other" is selected) */}
            {profession === 'Other' && (
              <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white/40 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.25 11.25.75 6m0 0h21.5M.75 6v12a2.25 2.25 0 0 0 2.25 2.25h19.5A2.25 2.25 0 0 0 24 18V6M1.08 6h21.84"
                  />
                </svg>
    
                <input
                  type="text"
                  placeholder="Enter your profession"
                  value={customProfession}
                  onChange={(e) => setCustomProfession(e.target.value)}
                  required
                  className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
                />
              </div>
            )}

            {/* Third Row: Email */}
            <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white/40 flex-shrink-0"
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
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
              />
            </div>

            {/* Fourth Row: Password */}
            <div className="flex items-center gap-3 bg-[#111] border border-white/10 px-4 py-3 rounded-lg focus-within:border-white focus-within:shadow-lg focus-within:shadow-white/10 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white/40 flex-shrink-0"
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
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-transparent w-full text-white placeholder-white/40 focus:outline-none"
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-white/40 hover:text-white/60 transition-colors flex-shrink-0"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
  
            {/* SignUp Button */}
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-cyan-400 hover:from-indigo-600 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all mt-6"
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