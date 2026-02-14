import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Chat from './components/Chat';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-[#050505] text-white selection:bg-indigo-500/30">
              <Navbar />
              <main>
                <Hero />
                <Features />
              </main>
              <footer className="py-10 text-center text-gray-600 text-sm border-t border-white/5">
                © 2025 Lock-In AI. Built for the next generation of devs.
              </footer>
            </div>
          }
        />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  );
};

export default App;