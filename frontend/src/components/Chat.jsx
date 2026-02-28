import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WebContainer } from '@webcontainer/api';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionFiles, setSessionFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [webcontainerUrl, setWebcontainerUrl] = useState(null);
  const [webcontainerReady, setWebcontainerReady] = useState(false);
  const messagesEndRef = useRef(null);
  const iframeRef = useRef(null);
  const webcontainerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  const initializeWebContainer = async (files) => {
    try {
      // Boot up WebContainer
      const container = await WebContainer.boot();
      webcontainerRef.current = container;
      
      
      // Write files to the container
      for (const [filename, content] of Object.entries(files)) {
        // Create directory structure
        const dirPath = filename.substring(0, filename.lastIndexOf('/'));
        if (dirPath) {
          await container.fs.mkdir(dirPath, { recursive: true });
        }
        // Write file
        await container.fs.writeFile(filename, content);
      }
      
      // Check if package.json exists, if so run npm install
      if (files['package.json']) {
        const installProcess = await container.spawn('npm', ['install']);
        await installProcess.exit;
      }
      
      // Start dev server (assumes vite, next, or create-react-app)
      let devProcess;
      if (files['vite.config.js'] || files['vite.config.ts']) {
        devProcess = await container.spawn('npm', ['run', 'dev']);
      } else if (files['next.config.js']) {
        devProcess = await container.spawn('npm', ['run', 'dev']);
      } else if (files['package.json']) {
        devProcess = await container.spawn('npm', ['start']);
      }
      
      // Listen for server ready
      container.on('server-ready', (port, url) => {
        console.log(`Server is live at: ${url} on port ${port}`);
        setWebcontainerUrl(url);
        setWebcontainerReady(true);
      });
      
      console.log('WebContainer initialized and running');
    } catch (error) {
      console.error('WebContainer initialization failed:', error);
      setWebcontainerReady(false);
    }
  };

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userPrompt = input;
    setInput('');
    setLoading(true);

    // Add initial bot message
    const botMessageId = Date.now() + 1;
    const initialBotMessage = {
      id: botMessageId,
      text: 'Initializing agent...',
      sender: 'bot',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, initialBotMessage]);

    try {
      // Use fetch with streaming for POST requests
      const response = await fetch('http://localhost:8000/prompt/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: userPrompt,
          search_method: false 
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentSessionId = null;
      let currentPreviewUrl = null;
      let fileCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setLoading(false);
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages (they end with \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim() || !message.startsWith('data: ')) continue;
          
          try {
            const jsonStr = message.replace(/^data: /, '');
            const data = JSON.parse(jsonStr);
            const eventType = data.type;
            const eventData = data.data;

            console.log('Received SSE event:', eventType, eventData);

            switch (eventType) {
              case 'session_start':
                currentSessionId = eventData.session_id;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `Session started: ${currentSessionId}` }
                      : msg
                  )
                );
                break;

              case 'status':
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: eventData.message }
                      : msg
                  )
                );
                break;

              case 'plan_created':
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `Planning complete. Tech stack: ${eventData.tech_stack}. Building files...` }
                      : msg
                  )
                );
                break;

              case 'file_created':
                fileCount++;
                const filename = eventData.filename;
                const content = eventData.content;
                
                // Update bot message with progress
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `Generated ${fileCount} files. Latest: ${filename}` }
                      : msg
                  )
                );

                // Add file to sessionFiles immediately
                setSessionFiles((prev) => {
                  const updated = { ...prev, [filename]: content };
                  
                  // Auto-select first file
                  if (fileCount === 1) {
                    setSelectedFile(filename);
                  }
                  
                  return updated;
                });
                break;

              case 'complete':
                setLoading(false);
                
                currentPreviewUrl = eventData.preview_url;
                if (currentPreviewUrl) {
                  setWebcontainerUrl(currentPreviewUrl);
                  setWebcontainerReady(true);
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `✅ Project complete! Generated ${fileCount} files.` }
                      : msg
                  )
                );
                break;

              case 'error':
                setLoading(false);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `❌ Error: ${eventData.error}` }
                      : msg
                  )
                );
                break;
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: '❌ Error sending prompt. Please try again.' }
            : msg
        )
      );
    }
  };

  // Resizable panels state
  const [chatWidth, setChatWidth] = useState(30);
  const [renderHeight, setRenderHeight] = useState(50);
  const [fileTreeWidth, setFileTreeWidth] = useState(200); // New: file panel width in pixels
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isDraggingRender, setIsDraggingRender] = useState(false);
  const [isDraggingFileTree, setIsDraggingFileTree] = useState(false); // New

  const handleMouseDownChat = () => setIsDraggingChat(true);
  const handleMouseDownRender = () => setIsDraggingRender(true);
  const handleMouseDownFileTree = () => setIsDraggingFileTree(true); // New

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingChat(false);
      setIsDraggingRender(false);
      setIsDraggingFileTree(false);
    };

    const handleMouseMove = (e) => {
      if (isDraggingChat) {
        const container = document.getElementById('panels-container');
        if (container) {
          const newChatWidth = (e.clientX / container.clientWidth) * 100;
          if (newChatWidth > 20 && newChatWidth < 60) {
            setChatWidth(newChatWidth);
          }
        }
      }
      if (isDraggingRender) {
        const rightPanel = document.getElementById('right-panels');
        if (rightPanel) {
          const newRenderHeight = ((e.clientY - rightPanel.offsetTop) / rightPanel.clientHeight) * 100;
          if (newRenderHeight > 20 && newRenderHeight < 80) {
            setRenderHeight(newRenderHeight);
          }
        }
      }
      if (isDraggingFileTree) {
        const newWidth = e.clientX - document.getElementById('code-panel').offsetLeft;
        if (newWidth > 150 && newWidth < 400) {
          setFileTreeWidth(newWidth);
        }
      }
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

  const rightPanelWidth = 100 - chatWidth;
  const codingHeight = 100 - renderHeight;

  // Build hierarchical file tree
  const buildFileTree = (files) => {
    const tree = {};
    Object.keys(files).forEach((path) => {
      // Normalize path to use forward slashes
      const normalizedPath = path.replace(/\\/g, '/');
      const parts = normalizedPath.split('/').filter(p => p.length > 0);
      
      let current = tree;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file - store exact key from sessionFiles
          current[part] = { type: 'file', path: path };
        } else {
          // It's a folder
          if (!current[part]) {
            current[part] = { type: 'folder', children: {} };
          }
          if (!current[part].children) {
            current[part].children = {};
          }
          current = current[part].children;
        }
      });
    });
    return tree;
  };

  const fileTree = buildFileTree(sessionFiles);

  // Render file tree recursively with proper folder/file separation
  const renderFileTree = (tree, depth = 0) => {
    const items = Object.keys(tree).sort();
    const folders = items.filter(name => tree[name].type === 'folder');
    const files = items.filter(name => tree[name].type === 'file');
    
    // Render folders first, then files
    const renderedFolders = folders.map((name) => {
      const item = tree[name];
      return (
        <div key={`folder-${name}`} style={{ marginLeft: `${depth * 12}px` }}>
          <div className="text-xs font-semibold text-gray-400 py-1 px-2 hover:bg-white/5 rounded">
            📁 {name}
          </div>
          {renderFileTree(item.children, depth + 1)}
        </div>
      );
    });

    const renderedFiles = files.map((name) => {
      const item = tree[name];
      return (
        <button
          key={`file-${item.path}`}
          onClick={() => setSelectedFile(item.path)}
          className={`block w-full text-left px-2 py-1 text-xs truncate transition-colors rounded ${
            selectedFile === item.path
              ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-500'
              : 'text-gray-400 hover:bg-white/5'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
          title={item.path}
        >
          📄 {name}
        </button>
      );
    });

    return [...renderedFolders, ...renderedFiles];
  };

  // Handle code editing
  const handleCodeEdit = (newCode) => {
    if (selectedFile) {
      setSessionFiles((prev) => ({
        ...prev,
        [selectedFile]: newCode,
      }));
      
      // Update webcontainer file if it's a frontend file
      if (webcontainerRef.current && !selectedFile.includes('.py')) {
        webcontainerRef.current.fs.writeFile(selectedFile, newCode);
      }
    }
  };

  // Debug: log selectedFile and available keys
  useEffect(() => {
    if (selectedFile) {
      const fileExists = selectedFile in sessionFiles;
      const content = sessionFiles[selectedFile];
      console.log('=== FILE SELECTION DEBUG ===');
      console.log('Selected file:', selectedFile);
      console.log('File exists in sessionFiles:', fileExists);
      console.log('Content length:', content ? content.length : 0);
      console.log('Available files:', Object.keys(sessionFiles).slice(0, 5));
      if (!fileExists) {
        console.warn('⚠️ FILE NOT FOUND IN sessionFiles!');
      }
    }
  }, [selectedFile, sessionFiles]);

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
        <button className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-semibold hover:opacity-80 transition-all">
          A
        </button>
      </div>

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 overflow-hidden" id="panels-container">
        <div className="flex h-full">
          {/* Chat Panel */}
          <div style={{ width: `${chatWidth}%` }} className="bg-[#050505] flex flex-col border-r border-white/5">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold">Start Coding</h2>
                    <p className="text-gray-400 text-xs max-w-xs">
                      Send a message to get started with your coding assistant.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.sender === 'user'
                            ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                            : 'bg-gray-800/50 border border-gray-700/50 text-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800/50 border border-gray-700/50 px-3 py-2 rounded-lg">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 bg-[#050505]/80 backdrop-blur-lg px-4 py-3">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={loading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-lg px-4 py-2 font-semibold flex items-center gap-2 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Resize Handle - Chat/Right Panels */}
          <div
            onMouseDown={handleMouseDownChat}
            className="w-3 bg-white/5 hover:bg-white/10 cursor-col-resize transition-colors flex items-center justify-center"
          >
            <span className="w-1.5 h-6 rounded-full bg-white/70"></span>
          </div>

          {/* Right Panels Container - Render and Coding stacked vertically */}
          <div style={{ width: `${rightPanelWidth}%` }} className="flex flex-col" id="right-panels">
            {/* Render Window Panel */}
            <div style={{ height: `${renderHeight}%` }} className="bg-[#0a0a0a] flex flex-col border-b border-white/5 overflow-hidden">
              {webcontainerReady && webcontainerUrl ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={webcontainerUrl}
                    className="w-full h-full border-none"
                    title="Live Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  />
                </>
              ) : webcontainerUrl ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-400 text-sm">Starting dev server...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm font-medium">Render Window</p>
                    <p className="text-gray-600 text-xs mt-2">Generated code will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Resize Handle - Render/Coding */}
            <div
              onMouseDown={handleMouseDownRender}
              className="h-3 bg-white/5 hover:bg-white/10 cursor-row-resize transition-colors flex items-center justify-center"
            >
              <span className="w-6 h-1.5 rounded-full bg-white/70"></span>
            </div>

            {/* Code and File Window Panel */}
            <div style={{ height: `${codingHeight}%` }} className="bg-[#0a0a0a] flex flex-col overflow-hidden" id="code-panel">
              <div className="flex h-full">
                {/* File Tree */}
                <div style={{ width: `${fileTreeWidth}px` }} className="bg-[#0a0a0a] border-r border-white/5 overflow-y-auto flex-shrink-0">
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Files</p>
                    {Object.keys(sessionFiles).length > 0 ? (
                      <div className="space-y-0.5">
                        {renderFileTree(fileTree)}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">No files yet</p>
                    )}
                  </div>
                </div>

                {/* Resize Handle - File Tree/Code */}
                <div
                  onMouseDown={handleMouseDownFileTree}
                  className="w-1 bg-white/5 hover:bg-indigo-500/50 cursor-col-resize transition-colors"
                />

                {/* Code Editor */}
                <div className="flex-1 overflow-hidden bg-[#050505] flex flex-col">
                  {selectedFile && sessionFiles[selectedFile] ? (
                    <>
                      {/* File Header */}
                      <div className="bg-[#0a0a0a] border-b border-white/5 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-mono">{selectedFile}</span>
                        <button 
                          onClick={() => {
                            // TODO: Implement run functionality
                            console.log('Running file:', selectedFile);
                          }}
                          className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-xs text-green-400 font-semibold transition-colors flex items-center gap-1"
                        >
                          ▶ Run
                        </button>
                      </div>
                      
                      {/* Code Editor Area */}
                      <textarea
                        value={sessionFiles[selectedFile]}
                        onChange={(e) => handleCodeEdit(e.target.value)}
                        className="flex-1 p-4 text-xs font-mono text-gray-300 bg-[#050505] border-none outline-none resize-none"
                        spellCheck={false}
                        style={{ 
                          tabSize: 2,
                          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                          lineHeight: '1.5'
                        }}
                      />
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-600 text-sm">Select a file to view and edit code</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;