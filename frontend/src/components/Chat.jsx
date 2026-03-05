import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MoreHorizontal, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WebContainer } from '@webcontainer/api';
import JSZip from 'jszip';
import PropertyEditor from './PropertyEditor';
import { createElementInspectorScript } from '../utils/elementInspector';
import { processJsxFiles, resetIdTracking } from '../utils/astProcessor';
import { updateElementStyles } from '../utils/codeUpdater';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionFiles, setSessionFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [webcontainerUrl, setWebcontainerUrl] = useState(null);
  const [webcontainerReady, setWebcontainerReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [threadId, setThreadId] = useState(null); // Persistent thread ID for multi-turn conversations
  
  // Visual Editing State
  const [visualEditingEnabled, setVisualEditingEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [editorPanelOpen, setEditorPanelOpen] = useState(false);
  const [elementIdMapping, setElementIdMapping] = useState({}); // Maps data-id to file info
  
  const messagesEndRef = useRef(null);
  const iframeRef = useRef(null);
  const webcontainerRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [menuOpen]);

  // Setup message listener for iframe communication
  useEffect(() => {
    const handleMessage = (e) => {
      // Only accept messages from iframe
      if (e.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (e.data.type === 'ELEMENT_SELECTED') {
        const elementData = e.data.data;
        setSelectedElement(elementData);
        setEditorPanelOpen(true);
        console.log('[Visual Editor] Element selected:', elementData);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Toggle inspector when visual editing is enabled/disabled
  useEffect(() => {
    if (visualEditingEnabled) {
      console.log('[Visual Editor] Edit Mode ON');
      // Send message to iframe to activate inspector
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'TOGGLE_INSPECTOR',
            active: true,
          },
          '*'
        );
      }
    } else {
      console.log('[Visual Editor] Edit Mode OFF');
      // Send message to iframe to deactivate inspector
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'TOGGLE_INSPECTOR',
            active: false,
          },
          '*'
        );
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'CLEAR_INSPECTOR_HIGHLIGHT',
          },
          '*'
        );
      }
      // Clear selection when turning off edit mode
      setSelectedElement(null);
      setEditorPanelOpen(false);
    }
  }, [visualEditingEnabled]);

  // Handle style updates from PropertyEditor
  const handleStyleUpdate = async (styles) => {
    if (!selectedElement || !selectedElement.dataId) {
      return;
    }

    try {
      const { dataId } = selectedElement;
      const elementInfo = elementIdMapping[dataId];

      if (!elementInfo) {
        console.warn('[Visual Editor] Element info not found in mapping:', dataId);
        return;
      }

      const sourceFile = elementInfo.file;
      const currentContent = sessionFiles[sourceFile];

      if (!currentContent) {
        console.error('[Visual Editor] Source file not found:', sourceFile);
        return;
      }

      // Update the code using AST-based updater
      const updatedContent = updateElementStyles(currentContent, dataId, styles);

      // Update sessionFiles
      setSessionFiles(prev => ({
        ...prev,
        [sourceFile]: updatedContent,
      }));

      // Write to WebContainer if it's a frontend file
      if (webcontainerRef.current && !sourceFile.includes('.py')) {
        try {
          await webcontainerRef.current.fs.writeFile(sourceFile, updatedContent);
          console.log('[Visual Editor] File updated in WebContainer:', sourceFile);
        } catch (error) {
          console.warn('[Visual Editor] Could not update in WebContainer:', error);
        }
      }

      // Update the iframe immediately via postMessage
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'UPDATE_ELEMENT_STYLE',
            dataId,
            styles,
          },
          '*'
        );
      }
    } catch (error) {
      console.error('[Visual Editor] Error updating styles:', error);
    }
  };

  const exportAsZip = async () => {
    try {
      if (Object.keys(sessionFiles).length === 0) {
        alert('No files to export');
        return;
      }

      const zip = new JSZip();

      // Add all sessionFiles to the zip
      Object.entries(sessionFiles).forEach(([filename, content]) => {
        zip.file(filename, content);
      });

      // Generate zip blob
      const blob = await zip.generateAsync({ type: 'blob' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Project exported as zip successfully');
      setMenuOpen(false);
    } catch (error) {
      console.error('Error exporting as zip:', error);
      alert('Failed to export project as zip');
    }
  };

  const initializeWebContainer = async (files) => {
    try {
      const totalStart = performance.now();
      console.log('[WebContainer] Starting initialization...');

      // Properly tear down existing container
      if (webcontainerRef.current) {
        console.log('[WebContainer] Tearing down existing container...');
        try {
          await webcontainerRef.current.teardown();
          webcontainerRef.current = null;
        } catch (teardownError) {
          console.warn('[WebContainer] Teardown warning:', teardownError);
          webcontainerRef.current = null;
        }
      }

      // Reset states before booting new container
      setWebcontainerUrl(null);
      setWebcontainerReady(false);

      // Boot up WebContainer
      const bootStart = performance.now();
      console.log('[WebContainer] Step 1/4: Booting container...');
      const container = await WebContainer.boot();
      webcontainerRef.current = container;
      console.log(`[WebContainer] Step 1/4 complete in ${(performance.now() - bootStart).toFixed(0)} ms`);
      
      
      // Write files to the container
      const mountStart = performance.now();
      console.log(`[WebContainer] Step 2/4: Mounting ${Object.keys(files).length} files...`);
      for (const [filename, content] of Object.entries(files)) {
        // Create directory structure
        const dirPath = filename.substring(0, filename.lastIndexOf('/'));
        if (dirPath) {
          await container.fs.mkdir(dirPath, { recursive: true });
        }
        
        // Write file
        await container.fs.writeFile(filename, content);
      }
      console.log(`[WebContainer] Step 2/4 complete in ${(performance.now() - mountStart).toFixed(0)} ms`);
      const hasPackageJson = Boolean(files['package.json']);
      const hasPackageLockJson = Boolean(files['package-lock.json']);
      console.log(`[WebContainer] package.json present: ${hasPackageJson}`);
      console.log(`[WebContainer] package-lock.json present: ${hasPackageLockJson}`);
      
      // Check if package.json exists, if so run npm install
      if (hasPackageJson) {
        const installStart = performance.now();
        console.log('[WebContainer] Step 3/4: Running npm install...');
        const installProcess = await container.spawn('npm', ['install', '--legacy-peer-deps']);

        const installOutputPromise = installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const text = String(data || '').trim();
              if (text) console.log(`[WebContainer][npm install] ${text}`);
            },
          })
        );

        const installExitCode = await installProcess.exit;
        await installOutputPromise.catch(() => {});
        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`);
        }
        console.log(`[WebContainer] Step 3/4 complete in ${(performance.now() - installStart).toFixed(0)} ms`);
      }
      
      // Start dev server (assumes vite, next, or create-react-app)
      const devStart = performance.now();
      console.log('[WebContainer] Step 4/4: Starting dev server...');

      const serverReadyPromise = new Promise((resolve) => {
        container.on('server-ready', (port, url) => {
          console.log(`[WebContainer] Step 4/4 complete in ${(performance.now() - devStart).toFixed(0)} ms`);
          console.log(`[WebContainer] Server is live at: ${url} on port ${port}`);
          console.log(`[WebContainer] Total mount-to-render time: ${(performance.now() - totalStart).toFixed(0)} ms`);
          setWebcontainerUrl(url);
          setWebcontainerReady(true);
          resolve({ port, url });
        });
      });

      let devProcess;
      if (files['vite.config.js'] || files['vite.config.ts']) {
        devProcess = await container.spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0']);
      } else if (files['next.config.js']) {
        devProcess = await container.spawn('npm', ['run', 'dev']);
      } else if (hasPackageJson) {
        devProcess = await container.spawn('npm', ['start']);
      }

      if (devProcess) {
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const text = String(data || '').trim();
              if (text) console.log(`[WebContainer][dev] ${text}`);
            },
          })
        ).catch(() => {});

        devProcess.exit.then((code) => {
          console.log(`[WebContainer] Dev process exited with code ${code}`);
          if (code !== 0) {
            setWebcontainerReady(false);
          }
        });
      }

      const timeoutMs = 45000;
      await Promise.race([
        serverReadyPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`server-ready not fired within ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      
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

  // Helper function to preprocess JSX with data-id
  const preprocessJsxWithIds = (jsxContent, filePath) => {
    const result = processJsxFiles(
      { [filePath]: jsxContent },
      { strategy: 'all' }
    );
    
    const processedContent = result.processedFiles[filePath];
    const mapping = result.mapping || {};

    // Transform mapping to include file info
    const transformedMapping = {};
    Object.entries(mapping).forEach(([dataId, info]) => {
      transformedMapping[dataId] = {
        file: filePath,
        ...info,
      };
    });

    return {
      processedContent,
      mapping: transformedMapping,
    };
  };

  const injectInspectorScript = (htmlContent) => {
    if (!htmlContent || htmlContent.includes('[Inspector] ✓ SCRIPT LOADED IN IFRAME - Ready to detect clicks')) {
      return htmlContent;
    }

    const inspectorScript = createElementInspectorScript();
    const insertPoint = htmlContent.lastIndexOf('</body>');

    if (insertPoint === -1) {
      return htmlContent;
    }

    const beforeBody = htmlContent.substring(0, insertPoint);
    const afterBody = htmlContent.substring(insertPoint);
    return beforeBody + '<script>\n' + inspectorScript + '\n</script>\n' + afterBody;
  };

  const shouldPreprocessJsxForInspector = (filename, content) => {
    if (!['.jsx', '.tsx', '.js'].some(ext => filename.endsWith(ext))) {
      return false;
    }

    if (!filename.startsWith('src/')) {
      return false;
    }

    if (/\.test\.(jsx|tsx|js)$/.test(filename)) {
      return false;
    }

    if (!content || content.includes('data-id=')) {
      return false;
    }

    return true;
  };

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
      setWebcontainerUrl(null);
      setWebcontainerReady(false);

      // Use fetch with streaming for POST requests
      const response = await fetch('http://localhost:8000/prompt/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: userPrompt,
          search_method: false,
          thread_id: threadId  // Send persistent thread ID
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentSessionId = null;
      let currentThreadId = null;
      let currentPreviewUrl = null;
      let fileCount = 0;
      const streamedFiles = {};
      let finalExplanation = '';

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
                currentThreadId = eventData.thread_id;
                if (currentThreadId) {
                  setThreadId(currentThreadId);
                }
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: `Session started. Processing your request...` }
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
                let content = eventData.content;
                
                console.log('[File Created] Event received - filename:', filename, 'visualEditingEnabled:', visualEditingEnabled);
                
                // Always inject inspector script into HTML (inspector is inactive by default)
                if (filename.endsWith('index.html')) {
                  try {
                    content = injectInspectorScript(content);
                    console.log('[Visual Editor] Inspector script ensured in index.html');
                  } catch (error) {
                    console.warn('[Visual Editor] Could not inject inspector into HTML:', error.message);
                  }
                }
                
                // Preprocess JSX files with data-id attributes for visual editing
                if (shouldPreprocessJsxForInspector(filename, content)) {
                  try {
                    const { processedContent, mapping } = preprocessJsxWithIds(content, filename);
                    content = processedContent;
                    // Store the mapping for later use
                    setElementIdMapping(prev => ({
                      ...prev,
                      ...mapping,
                    }));
                    console.log('[Visual Editor] Preprocessed', filename, 'with', Object.keys(mapping).length, 'element IDs');
                  } catch (error) {
                    console.warn('[Visual Editor] Could not preprocess', filename, ':', error.message);
                  }
                }
                
                streamedFiles[filename] = content;
                
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

              case 'explanation_complete':
                finalExplanation = eventData.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { 
                          ...msg, 
                          text: finalExplanation || `✅ Project complete! Generated ${fileCount} files.`,
                          explanation: finalExplanation
                        }
                      : msg
                  )
                );
                break;

              case 'complete':
                setLoading(false);
                
                // Update thread ID from response
                if (eventData.thread_id) {
                  setThreadId(eventData.thread_id);
                }
                
                currentPreviewUrl = eventData.preview_url;
                if (currentPreviewUrl) {
                  setWebcontainerUrl(currentPreviewUrl);
                  setWebcontainerReady(true);
                } else if (Object.keys(streamedFiles).length > 0 && streamedFiles['package.json']) {
                  // Use streamedFiles if it has fresh content from this turn
                  console.log('[WebContainer] No preview_url from backend. Initializing local WebContainer with new files...');
                  await initializeWebContainer(streamedFiles);
                } else if (Object.keys(sessionFiles).length > 0 && sessionFiles['package.json']) {
                  // Fallback: use sessionFiles (useful for follow-up turns)
                  console.log('[WebContainer] Using cached sessionFiles to reinitialize WebContainer...');
                  await initializeWebContainer(sessionFiles);
                }

                // Use explanation if available, otherwise show completion message
                const completionMsg = finalExplanation || `✅ Project complete! Generated ${fileCount} files.`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId
                      ? { ...msg, text: completionMsg, explanation: finalExplanation }
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

        <div className="flex items-center gap-2">
          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50">
                <button 
                  onClick={exportAsZip}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors rounded-t-lg"
                >
                   Export as zip
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors rounded-b-lg border-t border-white/5">
                   Link to github
                </button>
              </div>
            )}
          </div>

          {/* Profile Button */}
          <button className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white font-semibold hover:opacity-80 transition-all">
            A
          </button>
        </div>
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
              {/* Render Window Header */}
              <div className="bg-[#0a0a0a]/80 border-b border-white/5 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">Preview</span>
                {webcontainerReady && webcontainerUrl && (
                  <button
                    onClick={() => {
                      setVisualEditingEnabled(!visualEditingEnabled);
                      if (!visualEditingEnabled) {
                        resetIdTracking();
                      }
                    }}
                    className={`text-xs px-3 py-1 rounded-md flex items-center gap-1 transition-all ${
                      visualEditingEnabled
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                    title="Toggle visual element editing"
                  >
                    {visualEditingEnabled ? (
                      <>
                        <Eye className="w-3 h-3" />
                        Edit Mode ON
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" />
                        Edit Mode OFF
                      </>
                    )}
                  </button>
                )}
              </div>

              {webcontainerReady && webcontainerUrl ? (
                <>
                  <iframe
                    ref={iframeRef}
                    src={webcontainerUrl}
                    onLoad={() => {
                      if (iframeRef.current && iframeRef.current.contentWindow) {
                        iframeRef.current.contentWindow.postMessage(
                          {
                            type: 'TOGGLE_INSPECTOR',
                            active: visualEditingEnabled,
                          },
                          '*'
                        );

                        if (!visualEditingEnabled) {
                          iframeRef.current.contentWindow.postMessage(
                            {
                              type: 'CLEAR_INSPECTOR_HIGHLIGHT',
                            },
                            '*'
                          );
                        }
                      }
                    }}
                    className="w-full h-full border-none flex-1"
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
                      <div className="bg-[#0a0a0a] border-b border-white/5 px-3 py-2">
                        <span className="text-xs text-gray-400 font-mono">{selectedFile}</span>
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

        {/* Property Editor Panel */}
        <PropertyEditor
          selectedElement={selectedElement}
          onUpdateStyle={handleStyleUpdate}
          onClose={() => {
            setEditorPanelOpen(false);
            setSelectedElement(null);
          }}
          isOpen={editorPanelOpen && visualEditingEnabled}
        />
      </div>
    </div>
  );
};

export default Chat;