// import React, { useState, useRef, useEffect } from 'react';
// import { Send, Sparkles } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
// import { WebContainer } from '@webcontainer/api';
// import { Send, Sparkles, Github, Loader2 } from 'lucide-react'; // Added Github and Loader2
// import SyncModal from './SyncModal'; // The component from Step 5


// const Chat = () => {
//   const [messages, setMessages] = useState([]);
//   const [input, setInput] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [sessionFiles, setSessionFiles] = useState({});
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [webcontainerUrl, setWebcontainerUrl] = useState(null);
//   const [webcontainerReady, setWebcontainerReady] = useState(false);
//   const messagesEndRef = useRef(null);
//   const iframeRef = useRef(null);
//   const webcontainerRef = useRef(null);
//   const navigate = useNavigate();


//   const [currentSessionId, setCurrentSessionId] = useState(null); // To track which session to sync
//   const [showSyncModal, setShowSyncModal] = useState(false);
//   const [isSyncing, setIsSyncing] = useState(false);



//   useEffect(() => {
//     // Check if user is authenticated
//     const token = localStorage.getItem('token');
//     if (!token) {
//       navigate('/');
//     }
//   }, [navigate]);

//   const initializeWebContainer = async (files) => {
//     try {
//       // Boot up WebContainer
//       const container = await WebContainer.boot();
//       webcontainerRef.current = container;
      
      
//       // Write files to the container
//       for (const [filename, content] of Object.entries(files)) {
//         // Create directory structure
//         const dirPath = filename.substring(0, filename.lastIndexOf('/'));
//         if (dirPath) {
//           await container.fs.mkdir(dirPath, { recursive: true });
//         }
//         // Write file
//         await container.fs.writeFile(filename, content);
//       }
      
//       // Check if package.json exists, if so run npm install
//       if (files['package.json']) {
//         const installProcess = await container.spawn('npm', ['install']);
//         await installProcess.exit;
//       }
      
//       // Start dev server (assumes vite, next, or create-react-app)
//       let devProcess;
//       if (files['vite.config.js'] || files['vite.config.ts']) {
//         devProcess = await container.spawn('npm', ['run', 'dev']);
//       } else if (files['next.config.js']) {
//         devProcess = await container.spawn('npm', ['run', 'dev']);
//       } else if (files['package.json']) {
//         devProcess = await container.spawn('npm', ['start']);
//       }
      
//       // Listen for server ready
//       container.on('server-ready', (port, url) => {
//         console.log(`Server is live at: ${url} on port ${port}`);
//         setWebcontainerUrl(url);
//         setWebcontainerReady(true);
//       });
      
//       console.log('WebContainer initialized and running');
//     } catch (error) {
//       console.error('WebContainer initialization failed:', error);
//       setWebcontainerReady(false);
//     }
//   };

//   useEffect(() => {
//     // Scroll to bottom of messages
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const handleSendMessage = async (e) => {
//     e.preventDefault();
//     if (!input.trim()) return;

//     // Add user message to chat
//     const userMessage = {
//       id: Date.now(),
//       text: input,
//       sender: 'user',
//       timestamp: new Date(),
//     };

//     setMessages((prev) => [...prev, userMessage]);
//     setInput('');
//     setLoading(true);

//     try {
//       const response = await fetch('http://localhost:8000/prompt', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ prompt: input }),
//       });

//       if (!response.ok) {
//         throw new Error(`Request failed with status ${response.status}`);
//       }

//       const data = await response.json();
//       if (data.session_id) {
//         setCurrentSessionId(data.session_id); // Save it here!
//     }

//       // 
//       // If the backend returned a preview URL from E2B
//       if (data.preview_url) {
//         setWebcontainerUrl(data.preview_url); // You can rename this state to previewUrl
//         setWebcontainerReady(true);
//         setLoading(false);
//       }
//       // 
      
//       const botMessage = {
//         id: Date.now() + 1,
//         text: `Agent generated files. Session: ${data.session_id}`,
//         sender: 'bot',
//         timestamp: new Date(),
//       };
//       setMessages((prev) => [...prev, botMessage]);
      
//       // Fetch generated files
//       if (data.session_id) {
//         try {
//           const filesResponse = await fetch(`http://localhost:8000/session/${data.session_id}/files`);
//           const filesData = await filesResponse.json();
          
//           // Filter out unwanted files and set all remaining files
//           const allFiles = filesData.files || {};
//           const codeFiles = Object.fromEntries(
//             Object.entries(allFiles).filter(([path]) => 
//               path.endsWith('.jsx') || 
//               path.endsWith('.js') || 
//               path.endsWith('.html') || 
//               path.endsWith('.css') ||
//               path === 'package.json'
//             )
//           );
          
//           console.log('Filtered code files:', Object.keys(codeFiles));
//           //
//           // setSessionFiles(codeFiles); 
//           setSessionFiles(allFiles);
//           // 

//           // Select first file automatically
//           const fileList = Object.keys(codeFiles);
//           if (fileList.length > 0) {
//             const firstFile = fileList[0];
//             console.log('Setting initial file to:', firstFile);
//             console.log('File content exists:', !!codeFiles[firstFile]);
//             setSelectedFile(firstFile);
//           }
          
//           // Initialize WebContainer with all code files
//           if (Object.keys(codeFiles).length > 0 && !data.preview_url) {
//             await initializeWebContainer(codeFiles);
//           }
//         } catch (error) {
//           console.error('Error fetching files:', error);
//         }
//       }
//     } catch (error) {
//       console.error('Error sending message:', error);
//       const botMessage = {
//         id: Date.now() + 1,
//         text: 'Error sending prompt to agent. Please try again.',
//         sender: 'bot',
//         timestamp: new Date(),
//       };
//       setMessages((prev) => [...prev, botMessage]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Resizable panels state
//   const [chatWidth, setChatWidth] = useState(30);
//   const [renderHeight, setRenderHeight] = useState(50);
//   const [fileTreeWidth, setFileTreeWidth] = useState(200); // New: file panel width in pixels
//   const [isDraggingChat, setIsDraggingChat] = useState(false);
//   const [isDraggingRender, setIsDraggingRender] = useState(false);
//   const [isDraggingFileTree, setIsDraggingFileTree] = useState(false); // New

//   const handleMouseDownChat = () => setIsDraggingChat(true);
//   const handleMouseDownRender = () => setIsDraggingRender(true);
//   const handleMouseDownFileTree = () => setIsDraggingFileTree(true); // New

//   useEffect(() => {
//     const handleMouseUp = () => {
//       setIsDraggingChat(false);
//       setIsDraggingRender(false);
//       setIsDraggingFileTree(false);
//     };

//     const handleMouseMove = (e) => {
//       if (isDraggingChat) {
//         const container = document.getElementById('panels-container');
//         if (container) {
//           const newChatWidth = (e.clientX / container.clientWidth) * 100;
//           if (newChatWidth > 20 && newChatWidth < 60) {
//             setChatWidth(newChatWidth);
//           }
//         }
//       }
//       if (isDraggingRender) {
//         const rightPanel = document.getElementById('right-panels');
//         if (rightPanel) {
//           const newRenderHeight = ((e.clientY - rightPanel.offsetTop) / rightPanel.clientHeight) * 100;
//           if (newRenderHeight > 20 && newRenderHeight < 80) {
//             setRenderHeight(newRenderHeight);
//           }
//         }
//       }
//       if (isDraggingFileTree) {
//         const newWidth = e.clientX - document.getElementById('code-panel').offsetLeft;
//         if (newWidth > 150 && newWidth < 400) {
//           setFileTreeWidth(newWidth);
//         }
//       }
//     };

//     if (isDraggingChat || isDraggingRender || isDraggingFileTree) {
//       document.addEventListener('mousemove', handleMouseMove);
//       document.addEventListener('mouseup', handleMouseUp);
//     }

//     return () => {
//       document.removeEventListener('mousemove', handleMouseMove);
//       document.removeEventListener('mouseup', handleMouseUp);
//     };
//   }, [isDraggingChat, isDraggingRender, isDraggingFileTree]);

//   const rightPanelWidth = 100 - chatWidth;
//   const codingHeight = 100 - renderHeight;

//   // Build hierarchical file tree
//   const buildFileTree = (files) => {
//     const tree = {};
//     Object.keys(files).forEach((path) => {
//       // Normalize path to use forward slashes
//       const normalizedPath = path.replace(/\\/g, '/');
//       const parts = normalizedPath.split('/').filter(p => p.length > 0);
      
//       let current = tree;
//       parts.forEach((part, index) => {
//         if (index === parts.length - 1) {
//           // It's a file - store exact key from sessionFiles
//           current[part] = { type: 'file', path: path };
//         } else {
//           // It's a folder
//           if (!current[part]) {
//             current[part] = { type: 'folder', children: {} };
//           }
//           if (!current[part].children) {
//             current[part].children = {};
//           }
//           current = current[part].children;
//         }
//       });
//     });
//     return tree;
//   };

//   const fileTree = buildFileTree(sessionFiles);

//   // Render file tree recursively with proper folder/file separation
//   const renderFileTree = (tree, depth = 0) => {
//     const items = Object.keys(tree).sort();
//     const folders = items.filter(name => tree[name].type === 'folder');
//     const files = items.filter(name => tree[name].type === 'file');
    
//     // Render folders first, then files
//     const renderedFolders = folders.map((name) => {
//       const item = tree[name];
//       return (
//         <div key={`folder-${name}`} style={{ marginLeft: `${depth * 12}px` }}>
//           <div className="text-xs font-semibold text-gray-400 py-1 px-2 hover:bg-white/5 rounded">
//             📁 {name}
//           </div>
//           {renderFileTree(item.children, depth + 1)}
//         </div>
//       );
//     });

//     const renderedFiles = files.map((name) => {
//       const item = tree[name];
//       return (
//         <button
//           key={`file-${item.path}`}
//           onClick={() => setSelectedFile(item.path)}
//           className={`block w-full text-left px-2 py-1 text-xs truncate transition-colors rounded ${
//             selectedFile === item.path
//               ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-500'
//               : 'text-gray-400 hover:bg-white/5'
//           }`}
//           style={{ marginLeft: `${depth * 12}px` }}
//           title={item.path}
//         >
//           📄 {name}
//         </button>
//       );
//     });

//     return [...renderedFolders, ...renderedFiles];
//   };

//   // Handle code editing
//   const handleCodeEdit = (newCode) => {
//     if (selectedFile) {
//       setSessionFiles((prev) => ({
//         ...prev,
//         [selectedFile]: newCode,
//       }));
      
//       // Update webcontainer file if it's a frontend file
//       if (webcontainerRef.current && !selectedFile.includes('.py')) {
//         webcontainerRef.current.fs.writeFile(selectedFile, newCode);
//       }
//     }
//   };

//   // Debug: log selectedFile and available keys
//   useEffect(() => {
//     if (selectedFile) {
//       const fileExists = selectedFile in sessionFiles;
//       const content = sessionFiles[selectedFile];
//       console.log('=== FILE SELECTION DEBUG ===');
//       console.log('Selected file:', selectedFile);
//       console.log('File exists in sessionFiles:', fileExists);
//       console.log('Content length:', content ? content.length : 0);
//       console.log('Available files:', Object.keys(sessionFiles).slice(0, 5));
//       if (!fileExists) {
//         console.warn('⚠️ FILE NOT FOUND IN sessionFiles!');
//       }
//     }
//   }, [selectedFile, sessionFiles]);

//   return (
//     <div className="h-screen bg-[#050505] text-white flex flex-col">
//       {/* Header */}
//       <div className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-lg px-6 py-4 flex items-center justify-between">
//         <div className="flex items-center gap-3">
//           <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
//             <Sparkles className="text-white w-5 h-5" />
//           </div>
//           <h1 className="text-2xl font-bold">Lock-In</h1>
//         </div>
//         <button className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-semibold hover:opacity-80 transition-all">
//           A
//         </button>
//       </div>

//       {/* Main Content with Resizable Panels */}
//       <div className="flex-1 overflow-hidden" id="panels-container">
//         <div className="flex h-full">
//           {/* Chat Panel */}
//           <div style={{ width: `${chatWidth}%` }} className="bg-[#050505] flex flex-col border-r border-white/5">
//             {/* Messages Container */}
//             <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
//               {messages.length === 0 ? (
//                 <div className="h-full flex items-center justify-center text-center">
//                   <div className="space-y-3">
//                     <h2 className="text-lg font-semibold">Start Coding</h2>
//                     <p className="text-gray-400 text-xs max-w-xs">
//                       Send a message to get started with your coding assistant.
//                     </p>
//                   </div>
//                 </div>
//               ) : (
//                 <>
//                   {messages.map((message) => (
//                     <div
//                       key={message.id}
//                       className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
//                     >
//                       <div
//                         className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
//                           message.sender === 'user'
//                             ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
//                             : 'bg-gray-800/50 border border-gray-700/50 text-gray-100'
//                         }`}
//                       >
//                         <p className="whitespace-pre-wrap break-words">{message.text}</p>
//                         <span className="text-xs text-gray-500 mt-1 block">
//                           {message.timestamp.toLocaleTimeString([], {
//                             hour: '2-digit',
//                             minute: '2-digit',
//                           })}
//                         </span>
//                       </div>
//                     </div>
//                   ))}
//                   {loading && (
//                     <div className="flex justify-start">
//                       <div className="bg-gray-800/50 border border-gray-700/50 px-3 py-2 rounded-lg">
//                         <div className="flex gap-2">
//                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
//                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
//                           <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                   <div ref={messagesEndRef} />
//                 </>
//               )}
//             </div>

//             {/* Input Area */}
//             <div className="border-t border-white/5 bg-[#050505]/80 backdrop-blur-lg px-4 py-3">
//               <form onSubmit={handleSendMessage} className="flex gap-2">
//                 <input
//                   type="text"
//                   value={input}
//                   onChange={(e) => setInput(e.target.value)}
//                   placeholder="Type your message..."
//                   disabled={loading}
//                   className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
//                 />
//                 <button
//                   type="submit"
//                   disabled={loading || !input.trim()}
//                   className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-lg px-4 py-2 font-semibold flex items-center gap-2 transition-all"
//                 >
//                   <Send className="w-4 h-4" />
//                 </button>
//               </form>
//             </div>
//           </div>

//           {/* Resize Handle - Chat/Right Panels */}
//           <div
//             onMouseDown={handleMouseDownChat}
//             className="w-3 bg-white/5 hover:bg-white/10 cursor-col-resize transition-colors flex items-center justify-center"
//           >
//             <span className="w-1.5 h-6 rounded-full bg-white/70"></span>
//           </div>

//           {/* Right Panels Container - Render and Coding stacked vertically */}
//           <div style={{ width: `${rightPanelWidth}%` }} className="flex flex-col" id="right-panels">
//             {/* Render Window Panel */}
//             <div style={{ height: `${renderHeight}%` }} className="bg-[#0a0a0a] flex flex-col border-b border-white/5 overflow-hidden">
//               {webcontainerReady && webcontainerUrl ? (
//                 <>
//                   <iframe
//                     ref={iframeRef}
//                     src={webcontainerUrl}
//                     className="w-full h-full border-none"
//                     title="Live Preview"
//                     sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
//                   />
//                 </>
//               ) : webcontainerUrl ? (
//                 <div className="flex-1 flex items-center justify-center">
//                   <div className="text-center">
//                     <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
//                     <p className="text-gray-400 text-sm">Starting dev server...</p>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="flex-1 flex items-center justify-center">
//                   <div className="text-center">
//                     <p className="text-gray-400 text-sm font-medium">Render Window</p>
//                     <p className="text-gray-600 text-xs mt-2">Generated code will appear here</p>
//                   </div>
//                 </div>
//               )}
//             </div>

//             {/* Resize Handle - Render/Coding */}
//             <div
//               onMouseDown={handleMouseDownRender}
//               className="h-3 bg-white/5 hover:bg-white/10 cursor-row-resize transition-colors flex items-center justify-center"
//             >
//               <span className="w-6 h-1.5 rounded-full bg-white/70"></span>
//             </div>

//             {/* Code and File Window Panel */}
//             <div style={{ height: `${codingHeight}%` }} className="bg-[#0a0a0a] flex flex-col overflow-hidden" id="code-panel">
//               <div className="flex h-full">
//                 {/* File Tree */}
//                 <div style={{ width: `${fileTreeWidth}px` }} className="bg-[#0a0a0a] border-r border-white/5 overflow-y-auto flex-shrink-0">
//                   <div className="p-2">
//                     <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Files</p>
//                     {Object.keys(sessionFiles).length > 0 ? (
//                       <div className="space-y-0.5">
//                         {renderFileTree(fileTree)}
//                       </div>
//                     ) : (
//                       <p className="text-xs text-gray-600">No files yet</p>
//                     )}
//                   </div>
//                 </div>

//                 {/* Resize Handle - File Tree/Code */}
//                 <div
//                   onMouseDown={handleMouseDownFileTree}
//                   className="w-1 bg-white/5 hover:bg-indigo-500/50 cursor-col-resize transition-colors"
//                 />

//                 {/* Code Editor */}
//                 <div className="flex-1 overflow-hidden bg-[#050505] flex flex-col">
//                   {selectedFile && sessionFiles[selectedFile] ? (
//                     <>
//                       {/* File Header */}
//                       <div className="bg-[#0a0a0a] border-b border-white/5 px-3 py-2 flex items-center justify-between">
//                         <span className="text-xs text-gray-400 font-mono">{selectedFile}</span>
//                         <button 
//                           onClick={() => {
//                             // TODO: Implement run functionality
//                             console.log('Running file:', selectedFile);
//                           }}
//                           className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-xs text-green-400 font-semibold transition-colors flex items-center gap-1"
//                         >
//                           ▶ Run
//                         </button>
//                       </div>
                      
//                       {/* Code Editor Area */}
//                       <textarea
//                         value={sessionFiles[selectedFile]}
//                         onChange={(e) => handleCodeEdit(e.target.value)}
//                         className="flex-1 p-4 text-xs font-mono text-gray-300 bg-[#050505] border-none outline-none resize-none"
//                         spellCheck={false}
//                         style={{ 
//                           tabSize: 2,
//                           fontFamily: 'Monaco, Consolas, "Courier New", monospace',
//                           lineHeight: '1.5'
//                         }}
//                       />
//                     </>
//                   ) : (
//                     <div className="flex items-center justify-center h-full">
//                       <p className="text-gray-600 text-sm">Select a file to view and edit code</p>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Chat;

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Github, Loader2, X, Folder, FileCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WebContainer } from '@webcontainer/api';
import SyncModal from './SyncModal'; // Make sure this path matches your file structure

const Chat = () => {
  // --- Existing States ---
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionFiles, setSessionFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [webcontainerUrl, setWebcontainerUrl] = useState(null);
  const [webcontainerReady, setWebcontainerReady] = useState(false);
  
  // --- New GitHub Sync States ---
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const messagesEndRef = useRef(null);
  const iframeRef = useRef(null);
  const webcontainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/');
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- GitHub Sync Logic ---
  const handleGithubSync = async (repoName) => {
    const token = localStorage.getItem('github_token');
    
    if (!token) {
      alert("Please connect your GitHub account in the Navbar first!");
      setShowSyncModal(false);
      return;
    }

    if (!currentSessionId) {
      alert("No active session found to sync.");
      return;
    }

    setIsSyncing(true);
    try {
      // session_id is required to find the correct local folder
      const res = await fetch(`http://localhost:8000/github/sync?session_id=${currentSessionId}&repo_name=${repoName}&token=${token}`, {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (res.ok && data.status === 'success') {
        alert(`🚀 Success! Repository created: ${data.repo_url}`);
        setShowSyncModal(false);
      } else {
        alert("Sync failed: " + (data.detail || "Check backend logs"));
      }
    } catch (error) {
      console.error("Sync Error:", error);
      alert("An error occurred while connecting to the server.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- WebContainer Logic ---
  const initializeWebContainer = async (files) => {
    try {
      const container = await WebContainer.boot();
      webcontainerRef.current = container;
      
      for (const [filename, content] of Object.entries(files)) {
        const dirPath = filename.substring(0, filename.lastIndexOf('/'));
        if (dirPath) await container.fs.mkdir(dirPath, { recursive: true });
        await container.fs.writeFile(filename, content);
      }
      
      if (files['package.json']) {
        const installProcess = await container.spawn('npm', ['install']);
        await installProcess.exit;
      }
      
      let devProcess;
      if (files['vite.config.js'] || files['vite.config.ts'] || files['package.json']) {
        devProcess = await container.spawn('npm', ['run', 'dev']);
      }
      
      container.on('server-ready', (port, url) => {
        setWebcontainerUrl(url);
        setWebcontainerReady(true);
      });
    } catch (error) {
      console.error('WebContainer failed:', error);
      setWebcontainerReady(false);
    }
  };

  // --- Message Handling ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), text: input, sender: 'user', timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) throw new Error("Request failed");

      const data = await response.json();
      
      if (data.session_id) {
        setCurrentSessionId(data.session_id); // Critical: Store ID for GitHub Sync
        
        if (data.preview_url) {
          setWebcontainerUrl(data.preview_url);
          setWebcontainerReady(true);
        }

        const filesResponse = await fetch(`http://localhost:8000/session/${data.session_id}/files`);
        const filesData = await filesResponse.json();
        const allFiles = filesData.files || {};
        
        setSessionFiles(allFiles);
        const fileList = Object.keys(allFiles);
        if (fileList.length > 0) setSelectedFile(fileList[0]);

        if (fileList.length > 0 && !data.preview_url) {
          await initializeWebContainer(allFiles);
        }
      }
      
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        text: `Generation complete for session: ${data.session_id}`,
        sender: 'bot',
        timestamp: new Date(),
      }]);

    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [...prev, { id: Date.now() + 1, text: 'Error contacting agent.', sender: 'bot', timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  // --- Resizable Panels Logic ---
  const [chatWidth, setChatWidth] = useState(30);
  const [renderHeight, setRenderHeight] = useState(50);
  const [fileTreeWidth, setFileTreeWidth] = useState(200);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingRender, setIsDraggingRender] = useState(false);
  const [isDraggingFileTree, setIsDraggingFileTree] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingChat) setChatWidth((e.clientX / window.innerWidth) * 100);
      if (isDraggingRender) {
          const rightPanel = document.getElementById('right-panels');
          setRenderHeight(((e.clientY - rightPanel.offsetTop) / rightPanel.clientHeight) * 100);
      }
      if (isDraggingFileTree) setFileTreeWidth(e.clientX - document.getElementById('code-panel').offsetLeft);
    };
    const handleMouseUp = () => {
      setIsDraggingChat(false); setIsDraggingRender(false); setIsDraggingFileTree(false);
    };
    if (isDraggingChat || isDraggingRender || isDraggingFileTree) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingChat, isDraggingRender, isDraggingFileTree]);

  // --- File Tree Rendering ---
  const buildFileTree = (files) => {
    const tree = {};
    Object.keys(files).forEach((path) => {
      const parts = path.replace(/\\/g, '/').split('/').filter(p => p);
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) current[part] = { type: 'file', path };
        else {
          if (!current[part]) current[part] = { type: 'folder', children: {} };
          current = current[part].children;
        }
      });
    });
    return tree;
  };

  const renderFileTree = (tree, depth = 0) => {
    return Object.entries(tree).sort().map(([name, item]) => (
      <div key={name} style={{ marginLeft: `${depth * 12}px` }}>
        {item.type === 'folder' ? (
          <>
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 py-1 px-2"><Folder size={12}/> {name}</div>
            {renderFileTree(item.children, depth + 1)}
          </>
        ) : (
          <button
            onClick={() => setSelectedFile(item.path)}
            className={`flex items-center gap-1 w-full text-left px-2 py-1 text-xs truncate rounded ${selectedFile === item.path ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <FileCode size={12}/> {name}
          </button>
        )}
      </div>
    ));
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold">Lock-In</h1>
        </div>

        <div className="flex items-center gap-4">
          {currentSessionId && (
            <button 
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#24292e] hover:bg-black border border-white/10 rounded-lg text-sm font-semibold transition-all group"
            >
              <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Sync to GitHub
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold">A</div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex" id="panels-container">
        {/* Chat Panel */}
        <div style={{ width: `${chatWidth}%` }} className="flex flex-col border-r border-white/5">
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${m.sender === 'user' ? 'bg-indigo-500/20 border border-indigo-500/50' : 'bg-gray-800/50'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="Build something new..."
            />
            <button type="submit" disabled={loading} className="bg-indigo-500 p-2 rounded-lg"><Send size={18}/></button>
          </form>
        </div>

        {/* Vertical Resize */}
        <div onMouseDown={() => setIsDraggingChat(true)} className="w-1 hover:bg-indigo-500/50 cursor-col-resize" />

        {/* Right Panels */}
        <div style={{ width: `${100 - chatWidth}%` }} className="flex flex-col" id="right-panels">
          <div style={{ height: `${renderHeight}%` }} className="bg-black relative">
            {webcontainerUrl ? (
              <iframe src={webcontainerUrl} className="w-full h-full border-none" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-sm italic">Preview Area</div>
            )}
          </div>

          <div onMouseDown={() => setIsDraggingRender(true)} className="h-1 hover:bg-indigo-500/50 cursor-row-resize" />

          <div className="flex-1 flex overflow-hidden" id="code-panel">
            <div style={{ width: `${fileTreeWidth}px` }} className="border-r border-white/5 p-2 overflow-y-auto">
              {renderFileTree(buildFileTree(sessionFiles))}
            </div>
            
            <div onMouseDown={() => setIsDraggingFileTree(true)} className="w-1 hover:bg-indigo-500/50 cursor-col-resize" />

            <div className="flex-1 bg-[#050505] p-4">
              {selectedFile ? (
                <textarea
                  value={sessionFiles[selectedFile] || ''}
                  onChange={(e) => setSessionFiles({...sessionFiles, [selectedFile]: e.target.value})}
                  className="w-full h-full bg-transparent font-mono text-xs outline-none resize-none"
                  spellCheck={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-700">Select a file to edit</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSyncModal && (
        <SyncModal 
          onClose={() => setShowSyncModal(false)} 
          onSync={handleGithubSync} 
        />
      )}
    </div>
  );
};

export default Chat;