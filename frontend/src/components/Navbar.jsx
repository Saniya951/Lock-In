// import React, { useState, useEffect } from 'react';
// import { Sparkles } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import Signup from './Signup';
// import Login from './Login';
// import { Github } from 'lucide-react';

// const Navbar = () => {
//   const [showSignup, setShowSignup] = useState(false);
//   const [showLogin, setShowLogin] = useState(false);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const navigate = useNavigate();

//   useEffect(() => {
//     // Check if token is in URL (from verification page)
//     const params = new URLSearchParams(window.location.search);
//     const urlToken = params.get('token');
//     const githubToken = params.get('github_token');
    
//     if (urlToken) {
//       localStorage.setItem('token', urlToken);
//       setIsAuthenticated(true);
//       // Clean up URL
//       window.history.replaceState({}, '', window.location.pathname);
//       return;
//     }

//     if (githubToken) {
//     localStorage.setItem('github_token', githubToken);
//     // Clean up URL
//     window.history.replaceState({}, '', window.location.pathname);
//   }

//     // Check if token is already in localStorage
//     const token = localStorage.getItem('token');
//     setIsAuthenticated(!!token);
//   }, []);

//   const handleLogout = () => {
//     localStorage.removeItem('token');
//     setIsAuthenticated(false);
//   };

//   const handleConnectGithub = () => {
//   window.location.href = "http://localhost:8000/github/login";
// };

//   const handleStartCoding = () => {
//     if (!isAuthenticated) {
//       setShowLogin(true);
//     } else {
//       // User is authenticated, navigate to Chat page
//       navigate('/chat');
//     }
//   };

//   return (
//     <>
//       <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-lg">
//         <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
//               <Sparkles className="text-white w-5 h-5" />
//             </div>
//             <span className="text-xl font-bold text-white tracking-tight">Lock-In</span>
//           </div>
//           <div className="flex items-center gap-3">
//             {!isAuthenticated ? (
//               <>
//                 <button
//                   onClick={() => setShowLogin(true)}
//                   className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
//                 >
//                   Login
//                 </button>

//                 <button
//                   onClick={() => setShowSignup(true)}
//                   className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
//                 >
//                   Sign Up
//                 </button>
//               </>
//             ) : (
//               <button
//                 onClick={handleLogout}
//                 className="px-5 py-2.5 rounded-full bg-transparent text-white font-semibold text-sm border-2 border-transparent hover:border-gray-300 transition-all duration-300"
//               >
//                 Logout
//               </button>
//             )}

//             <button 
//               onClick={handleStartCoding}
//               className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-all"
//             >
//               Start Coding
//             </button>


//             {isAuthenticated && (
//     <button 
//       onClick={handleConnectGithub}
//       className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#24292e] text-white font-semibold text-sm hover:bg-black transition-all"
//     >
//       <Github className="w-4 h-4" />
//       {localStorage.getItem('github_token') ? 'GitHub Connected' : 'Connect GitHub'}
//     </button>
//   )}
//           </div>
//         </div>
//       </nav>
//       {showSignup && <Signup onClose={() => setShowSignup(false)} onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }} />}
//       {showLogin && <Login onClose={() => setShowLogin(false)} onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }} />}
//     </>
//   );
// };

// export default Navbar;



import React, { useState, useEffect } from 'react';
import { Sparkles, Github } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Signup from './Signup';
import Login from './Login';

const Navbar = () => {
  const [showSignup, setShowSignup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGithubConnected, setIsGithubConnected] = useState(!!localStorage.getItem('github_token'));
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Initial Token Checks (URL and LocalStorage)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setIsAuthenticated(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);

    // 2. LISTEN FOR GITHUB POPUP MESSAGE
    const handleMessage = (event) => {
    // Check if the data contains our token
    if (event.data && event.data.github_token) {
      console.log("Token received in React:", event.data.github_token);
      localStorage.setItem('github_token', event.data.github_token);
      setIsGithubConnected(true);
    }
  };

    window.addEventListener("message", handleMessage);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('github_token'); // Optional: clear github on logout
    setIsAuthenticated(false);
    setIsGithubConnected(false);
  };

  const handleConnectGithub = () => {
    // Define popup size and position
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open the FastAPI route in a popup window
    window.open(
      "http://localhost:8000/github/login",
      "GitHub Login",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleStartCoding = () => {
    if (!isAuthenticated) {
      setShowLogin(true);
    } else {
      navigate('/chat');
    }
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
            {/* GitHub Connect Button - Always visible if authenticated, updates on state change */}
            {isAuthenticated && (
              <button 
                onClick={handleConnectGithub}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#24292e] text-white font-semibold text-sm hover:bg-black transition-all duration-300"
              >
                <Github className="w-4 h-4" />
                {isGithubConnected ? 'GitHub Connected' : 'Connect GitHub'}
              </button>
            )}

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

      {showSignup && (
        <Signup 
          onClose={() => setShowSignup(false)} 
          onSwitchToLogin={() => { setShowSignup(false); setShowLogin(true); }} 
        />
      )}
      
      {showLogin && (
        <Login 
          onClose={() => setShowLogin(false)} 
          onSwitchToSignup={() => { setShowLogin(false); setShowSignup(true); }} 
        />
      )}
    </>
  );
};

export default Navbar;