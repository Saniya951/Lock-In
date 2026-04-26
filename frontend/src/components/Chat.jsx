import React, { useState, useRef, useEffect } from 'react';
import { Send, MoreHorizontal, Eye, EyeOff, Database, Globe, PanelLeftClose, PanelLeftOpen, MessageSquarePlus, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WebContainer } from '@webcontainer/api';
import JSZip from 'jszip';
import Navbar from './Navbar';
import PropertyEditor from './PropertyEditor';
import { createElementInspectorScript } from '../utils/elementInspector';
import { processJsxFiles, resetIdTracking } from '../utils/astProcessor';
import { updateElementStyles } from '../utils/codeUpdater';
import useThemeMode from '../hooks/useThemeMode';

const API_BASE = 'http://localhost:8000';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [files, setFiles] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [webcontainerUrl, setWebcontainerUrl] = useState(null);
  const [webcontainerReady, setWebcontainerReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [threadId, setThreadId] = useState(null); // Persistent thread ID for multi-turn conversations
  const { isDarkMode, setIsDarkMode } = useThemeMode();
  const [useDeepSearch, setUseDeepSearch] = useState(false); // False: vector search, True: Tavily deep search
  const [projectStatuses, setProjectStatuses] = useState({});
  
  // Visual Editing State
  const [visualEditingEnabled, setVisualEditingEnabled] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [editorPanelOpen, setEditorPanelOpen] = useState(false);
  const [elementIdMapping, setElementIdMapping] = useState({}); // Maps data-id to file info
  
  const messagesEndRef = useRef(null);
  const iframeRef = useRef(null);
  const webcontainerRef = useRef(null);
  const projectRootRef = useRef('');
  const menuRef = useRef(null);
  const creatingProjectPromiseRef = useRef(null);
  const authErrorShownRef = useRef(false);
  const navigate = useNavigate();

  const normalizeProjectStatus = (value) => {
    const normalized = (value || '').toLowerCase();
    if (['pass', 'fail', 'running', 'idle'].includes(normalized)) {
      return normalized;
    }
    return 'idle';
  };

  const getProjectStatusMeta = (value) => {
    const normalized = normalizeProjectStatus(value);

    if (normalized === 'pass') {
      return {
        label: 'PASS',
        dotClass: 'bg-emerald-500',
      };
    }

    if (normalized === 'fail') {
      return {
        label: 'FAIL',
        dotClass: 'bg-red-500',
      };
    }

    if (normalized === 'running') {
      return {
        label: 'RUNNING',
        dotClass: 'bg-amber-500',
      };
    }

    return {
      label: 'IDLE',
      dotClass: 'bg-slate-400',
    };
  };

  const updateProjectStatus = (projectId, nextStatus) => {
    if (!projectId) {
      return;
    }

    setProjectStatuses((prev) => ({
      ...prev,
      [projectId]: normalizeProjectStatus(nextStatus),
    }));
  };

  const handleAuthFailure = () => {
    if (authErrorShownRef.current) {
      return;
    }

    authErrorShownRef.current = true;
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    alert('Your session has expired. Please log in again.');
    navigate('/');
  };

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data?.access_token) {
        return null;
      }

      localStorage.setItem('token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      return data.access_token;
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error);
      return null;
    }
  };

  const authHeaders = (tokenOverride = null, baseHeaders = {}) => {
    const token = tokenOverride || localStorage.getItem('token');
    return {
      ...baseHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    };
  };

  const authenticatedFetch = async (url, options = {}, hasRetried = false) => {
    const headers = authHeaders(null, options.headers || {});
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status !== 401) {
      return response;
    }

    if (hasRetried) {
      handleAuthFailure();
      return response;
    }

    const refreshedAccessToken = await refreshAccessToken();
    if (!refreshedAccessToken) {
      handleAuthFailure();
      return response;
    }

    const retryHeaders = authHeaders(refreshedAccessToken, options.headers || {});
    return fetch(url, {
      ...options,
      headers: retryHeaders,
    });
  };

  const startNewChat = () => {
    setCurrentProjectId(null);
    localStorage.removeItem('lockin.currentProjectId');
    setThreadId(null);
    setMessages([]);
    setFiles({});
    setActiveFile(null);
    setFileContent('');
    setIsDirty(false);
    setWebcontainerReady(false);
    setWebcontainerUrl(null);
  };

  const createProjectByName = async (projectName) => {
    const trimmedName = (projectName || '').trim();
    if (!trimmedName) {
      return null;
    }

    const response = await authenticatedFetch(`${API_BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: trimmedName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.status}`);
    }

    const data = await response.json();
    return data.project || null;
  };

  const promptProjectNameAndCreate = async (initialStatus = 'idle') => {
    if (creatingProjectPromiseRef.current) {
      return creatingProjectPromiseRef.current;
    }

    creatingProjectPromiseRef.current = (async () => {
      const enteredName = window.prompt('Enter a project name to save this chat');
      if (!enteredName || !enteredName.trim()) {
        return null;
      }

      try {
        const project = await createProjectByName(enteredName);
        if (!project) {
          return null;
        }

        setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
        setCurrentProjectId(project.id);
        updateProjectStatus(project.id, initialStatus);
        localStorage.setItem('lockin.currentProjectId', project.id);
        return project.id;
      } catch (error) {
        console.error('[Projects] Failed to create project during first save:', error);
        return null;
      }
    })();

    const resolvedProjectId = await creatingProjectPromiseRef.current;
    creatingProjectPromiseRef.current = null;
    return resolvedProjectId;
  };

  const persistGeneratedFiles = async (projectId, generatedFiles) => {
    if (!projectId || !generatedFiles) {
      return;
    }

    for (const [path, content] of Object.entries(generatedFiles)) {
      await persistFile(projectId, path, content);
    }
  };

  const guessLanguageFromPath = (path = '') => {
    const normalizedPath = normalizeProjectPath(path).toLowerCase();

    if (normalizedPath.endsWith('.jsx')) return 'javascriptreact';
    if (normalizedPath.endsWith('.tsx')) return 'typescriptreact';
    if (normalizedPath.endsWith('.ts')) return 'typescript';
    if (normalizedPath.endsWith('.js')) return 'javascript';
    if (normalizedPath.endsWith('.py')) return 'python';
    if (normalizedPath.endsWith('.css')) return 'css';
    if (normalizedPath.endsWith('.html')) return 'html';
    if (normalizedPath.endsWith('.json')) return 'json';
    return '';
  };

  const filesToMap = (fileList = []) => {
    const mapped = {};
    fileList.forEach((fileDoc) => {
      mapped[normalizeProjectPath(fileDoc.path)] = fileDoc.content;
    });
    return mapped;
  };

  const persistFile = async (projectId, path, content) => {
    if (!projectId || !path) {
      return null;
    }

    setIsSaving(true);

    try {
      const response = await authenticatedFetch(`${API_BASE}/files`, {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          path,
          content,
          language: guessLanguageFromPath(path),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.status}`);
      }

      setIsDirty(false);
      return await response.json();
    } catch (error) {
      console.error('[Projects] Failed to persist file:', error);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await authenticatedFetch(`${API_BASE}/projects`);

      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.status}`);
      }

      const data = await response.json();
      const projectList = data.projects || [];
      setProjects(projectList);
      setProjectStatuses(
        projectList.reduce((acc, project) => {
          acc[project.id] = 'idle';
          return acc;
        }, {})
      );

      const storedProjectId = localStorage.getItem('lockin.currentProjectId');
      const persistedProject = projectList.find((project) => project.id === storedProjectId) || null;

      if (persistedProject) {
        setCurrentProjectId(persistedProject.id);
        await loadProjectFiles(persistedProject.id);
        return;
      }

      setCurrentProjectId(null);
      setThreadId(null);
      setMessages([]);
      setFiles({});
      setActiveFile(null);
      setFileContent('');
    } catch (error) {
      console.error('[Projects] Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectFiles = async (projectId) => {
    if (!projectId) {
      setFiles({});
      setActiveFile(null);
      setFileContent('');
      setIsDirty(false);
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/projects/${projectId}/files`);

      if (!response.ok) {
        throw new Error(`Failed to load project files: ${response.status}`);
      }

      const data = await response.json();
      const fileMap = filesToMap(data.files || []);
      setFiles(fileMap);

      const firstFile = Object.keys(fileMap)[0] || null;
      setActiveFile(firstFile);
      setFileContent(firstFile ? fileMap[firstFile] : '');
      setIsDirty(false);

      if (Object.keys(fileMap).length > 0) {
        const hasPackageJson = Object.keys(fileMap).some((path) => normalizeProjectPath(path).endsWith('package.json'));
        if (hasPackageJson) {
          await initializeWebContainer(fileMap);
        }
      } else {
        setWebcontainerUrl(null);
        setWebcontainerReady(false);
      }
    } catch (error) {
      console.error('[Projects] Failed to load files:', error);
      setFiles({});
      setActiveFile(null);
      setFileContent('');
      setWebcontainerUrl(null);
      setWebcontainerReady(false);
    }
  };

  const handleSelectProject = async (projectId) => {
    if (!projectId || projectId === currentProjectId) {
      return;
    }

    setCurrentProjectId(projectId);
    localStorage.setItem('lockin.currentProjectId', projectId);
    setThreadId(null);
    setMessages([]);
    await loadProjectFiles(projectId);
  };

  const normalizeProjectPath = (path = '') =>
    path
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');

  const getProjectRootFromFiles = (files) => {
    const normalizedPaths = Object.keys(files).map(normalizeProjectPath);

    if (normalizedPaths.includes('package.json')) {
      return '';
    }

    const nestedPackageJsonPaths = normalizedPaths
      .filter((p) => p.endsWith('/package.json'))
      .sort((a, b) => a.length - b.length);

    if (nestedPackageJsonPaths.length === 0) {
      return '';
    }

    return nestedPackageJsonPaths[0].replace(/\/package\.json$/, '');
  };

  const resolveProjectFile = (root, file) => {
    const normalizedFile = normalizeProjectPath(file);
    return root ? `${root}/${normalizedFile}` : normalizedFile;
  };

  const isPathWithinRoot = (path, root) => {
    if (!root) {
      return true;
    }

    return path === root || path.startsWith(`${root}/`);
  };

  const shouldLiveInProjectRoot = (path) => {
    const appRelativeFiles = [
      'index.html',
      'package.json',
      'package-lock.json',
      'vite.config.js',
      'vite.config.ts',
      'next.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'eslint.config.js',
      'tsconfig.json',
      'jsconfig.json',
    ];

    if (appRelativeFiles.includes(path)) {
      return true;
    }

    return path.startsWith('src/') || path.startsWith('public/');
  };

  const toContainerProjectPath = (path, root = projectRootRef.current) => {
    const normalizedPath = normalizeProjectPath(path);

    if (!root || isPathWithinRoot(normalizedPath, root)) {
      return normalizedPath;
    }

    if (shouldLiveInProjectRoot(normalizedPath)) {
      return `${root}/${normalizedPath}`;
    }

    return normalizedPath;
  };

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  // Intentionally run once on mount to hydrate project state.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadProjects();
    }
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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

      const sourceFile = normalizeProjectPath(elementInfo.file);
      const containerSourceFile = toContainerProjectPath(sourceFile);
      const currentContent = files[sourceFile] ?? files[elementInfo.file];

      if (!currentContent) {
        console.error('[Visual Editor] Source file not found:', sourceFile);
        return;
      }

      // Update the code using AST-based updater
      const updatedContent = updateElementStyles(currentContent, dataId, styles);

      // Update files
      setFiles(prev => ({
        ...prev,
        [sourceFile]: updatedContent,
        ...(containerSourceFile !== sourceFile ? { [containerSourceFile]: updatedContent } : {}),
      }));

      if (activeFile && normalizeProjectPath(activeFile) === sourceFile) {
        setFileContent(updatedContent);
        setIsDirty(true);
      }

      // Write to WebContainer if it's a frontend file
      if (webcontainerRef.current && !sourceFile.includes('.py')) {
        try {
          await webcontainerRef.current.fs.writeFile(containerSourceFile, updatedContent);
          console.log('[Visual Editor] File updated in WebContainer:', containerSourceFile);
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
      if (Object.keys(files).length === 0) {
        alert('No files to export');
        return;
      }

      const zip = new JSZip();

      // Add all files to the zip
      Object.entries(files).forEach(([filename, content]) => {
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

      const normalizedFiles = {};
      Object.entries(files).forEach(([filename, content]) => {
        normalizedFiles[normalizeProjectPath(filename)] = content;
      });

      const projectRoot = getProjectRootFromFiles(normalizedFiles);
      projectRootRef.current = projectRoot;
      const projectCwd = projectRoot ? `/${projectRoot}` : '/';
      console.log(`[WebContainer] Resolved project root: ${projectRoot || '(root)'}`);

      const preparedFiles = {};
      Object.entries(normalizedFiles).forEach(([filename, content]) => {
        const containerPath = toContainerProjectPath(filename, projectRoot);
        preparedFiles[containerPath] = content;
      });

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
      console.log(`[WebContainer] Step 2/4: Mounting ${Object.keys(preparedFiles).length} files...`);
      for (const [filename, content] of Object.entries(preparedFiles)) {
        // Create directory structure
        const dirPath = filename.substring(0, filename.lastIndexOf('/'));
        if (dirPath) {
          await container.fs.mkdir(dirPath, { recursive: true });
        }
        
        // Write file
        await container.fs.writeFile(filename, content);
      }
      console.log(`[WebContainer] Step 2/4 complete in ${(performance.now() - mountStart).toFixed(0)} ms`);
      const hasPackageJson = Boolean(preparedFiles[resolveProjectFile(projectRoot, 'package.json')]);
      const hasPackageLockJson = Boolean(preparedFiles[resolveProjectFile(projectRoot, 'package-lock.json')]);
      console.log(`[WebContainer] package.json present: ${hasPackageJson}`);
      console.log(`[WebContainer] package-lock.json present: ${hasPackageLockJson}`);
      
      // Check if package.json exists, if so run npm install
      if (hasPackageJson) {
        const installStart = performance.now();
        console.log('[WebContainer] Step 3/4: Running npm install...');
        const installProcess = await container.spawn('npm', ['install', '--legacy-peer-deps'], {
          cwd: projectCwd,
        });

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
      if (
        preparedFiles[resolveProjectFile(projectRoot, 'vite.config.js')] ||
        preparedFiles[resolveProjectFile(projectRoot, 'vite.config.ts')]
      ) {
        devProcess = await container.spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], {
          cwd: projectCwd,
        });
      } else if (preparedFiles[resolveProjectFile(projectRoot, 'next.config.js')]) {
        devProcess = await container.spawn('npm', ['run', 'dev'], { cwd: projectCwd });
      } else if (hasPackageJson) {
        devProcess = await container.spawn('npm', ['start'], { cwd: projectCwd });
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
    if (currentProjectId) {
      updateProjectStatus(currentProjectId, 'running');
    }
    setLoading(true);
    let latestPromptStatus = 'fail';

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
      const response = await authenticatedFetch(`${API_BASE}/prompt/stream`, {
        method: 'POST',
        body: JSON.stringify({ 
          prompt: userPrompt,
          search_method: useDeepSearch,
          thread_id: threadId  // Send persistent thread ID
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
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

              case 'file_created': {
                fileCount++;
                const filename = normalizeProjectPath(eventData.filename);
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

                // Add file to files immediately
                setFiles((prev) => {
                  const updated = { ...prev, [filename]: content };
                  
                  // Auto-select first file
                  if (fileCount === 1) {
                    setActiveFile(filename);
                    setFileContent(content);
                    setIsDirty(false);
                  }
                  
                  return updated;
                });

                if (currentProjectId) {
                  void persistFile(currentProjectId, filename, content);
                }
                break;
              }

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

              case 'complete': {
                setLoading(false);
                latestPromptStatus = normalizeProjectStatus(eventData.status);
                if (currentProjectId) {
                  updateProjectStatus(currentProjectId, latestPromptStatus);
                }
                
                // Update thread ID from response
                if (eventData.thread_id) {
                  setThreadId(eventData.thread_id);
                }
                
                currentPreviewUrl = eventData.preview_url;
                const streamedHasPackageJson = Object.keys(streamedFiles).some(
                  (path) => normalizeProjectPath(path) === 'package.json' || normalizeProjectPath(path).endsWith('/package.json')
                );

                const sessionHasPackageJson = Object.keys(files).some(
                  (path) => normalizeProjectPath(path) === 'package.json' || normalizeProjectPath(path).endsWith('/package.json')
                );

                if (Object.keys(streamedFiles).length > 0 && streamedHasPackageJson) {
                  // Use streamedFiles if it has fresh content from this turn
                  console.log('[WebContainer] No preview_url from backend. Initializing local WebContainer with new files...');
                  await initializeWebContainer(streamedFiles);
                } else if (Object.keys(files).length > 0 && sessionHasPackageJson) {
                  // Fallback: use saved files (useful for follow-up turns)
                  console.log('[WebContainer] Using cached files to reinitialize WebContainer...');
                  await initializeWebContainer(files);
                } else if (currentPreviewUrl) {
                  // Final fallback when we don't have enough files for local boot
                  setWebcontainerUrl(currentPreviewUrl);
                  setWebcontainerReady(true);
                }

                if (!currentProjectId && Object.keys(streamedFiles).length > 0) {
                  const projectIdForSave = await promptProjectNameAndCreate(latestPromptStatus);
                  if (projectIdForSave) {
                    await persistGeneratedFiles(projectIdForSave, streamedFiles);
                  }
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
              }

              case 'error':
                setLoading(false);
                if (currentProjectId) {
                  updateProjectStatus(currentProjectId, 'fail');
                }
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
      if (currentProjectId) {
        updateProjectStatus(currentProjectId, 'fail');
      }
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
          // It's a file - store exact key from files
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

  const fileTree = buildFileTree(files);

  useEffect(() => {
    if (!activeFile) {
      setFileContent('');
      return;
    }

    const normalizedActiveFile = normalizeProjectPath(activeFile);
    const nextContent = files[normalizedActiveFile] ?? files[activeFile] ?? '';
    setFileContent(nextContent);
  }, [activeFile, files]);

  // Debounced autosave for active file changes.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!activeFile || !isDirty || !currentProjectId) {
      return;
    }

    const timeout = setTimeout(() => {
      const saveCurrentFile = async () => {
        await persistFile(currentProjectId, normalizeProjectPath(activeFile), fileContent);
      };

      void saveCurrentFile();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [fileContent, activeFile, isDirty, currentProjectId]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
          <div className={`text-xs font-semibold py-1 px-2 rounded transition-colors duration-300 ${
            isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-200'
          }`}>
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
          onClick={() => setActiveFile(item.path)}
          className={`block w-full text-left px-2 py-1 text-xs truncate transition-colors rounded ${
            activeFile === item.path
              ? isDarkMode
                ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-500'
                : 'bg-indigo-100 text-indigo-700 border-l-2 border-indigo-500'
              : isDarkMode
              ? 'text-gray-400 hover:bg-white/5'
              : 'text-gray-600 hover:bg-gray-200'
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

  const handleCodeEdit = (newCode) => {
    if (activeFile) {
      const normalizedSelectedFile = normalizeProjectPath(activeFile);
      const containerSelectedFile = toContainerProjectPath(normalizedSelectedFile);

      setFiles((prev) => ({
        ...prev,
        [normalizedSelectedFile]: newCode,
        ...(containerSelectedFile !== normalizedSelectedFile ? { [containerSelectedFile]: newCode } : {}),
      }));
      setFileContent(newCode);
      setIsDirty(true);
      
      // Update webcontainer file if it's a frontend file
      if (webcontainerRef.current && !normalizedSelectedFile.includes('.py')) {
        webcontainerRef.current.fs
          .writeFile(containerSelectedFile, newCode)
          .catch((error) => {
            console.error('[WebContainer] Failed to write edited file:', containerSelectedFile, error);
          });
      }
    }
  };

  const cleanSummaryInlineText = (value = '') =>
    value
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[\*_]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const parseSummaryBlocks = (rawText = '') => {
    const normalized = String(rawText || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const lines = normalized.split('\n');
    const blocks = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      const headingMatch =
        trimmed.match(/^\*\*(.+?)\*\*:?$/) ||
        trimmed.match(/^#{1,6}\s+(.+)$/);

      if (headingMatch) {
        const headingText = cleanSummaryInlineText(headingMatch[1]);
        if (headingText) {
          blocks.push({ type: 'heading', text: headingText });
        }
        return;
      }

      const bulletMatch =
        trimmed.match(/^[-*]\s+(.+)$/) ||
        trimmed.match(/^\d+\.\s+(.+)$/);

      if (bulletMatch) {
        const bulletText = cleanSummaryInlineText(bulletMatch[1]);
        if (bulletText) {
          blocks.push({ type: 'bullet', text: bulletText });
        }
        return;
      }

      const paragraphText = cleanSummaryInlineText(trimmed);
      if (paragraphText) {
        blocks.push({ type: 'paragraph', text: paragraphText });
      }
    });

    return blocks;
  };

  const renderFormattedSummary = (text) => {
    const blocks = parseSummaryBlocks(text);
    if (!blocks.length) {
      return <p className="whitespace-pre-wrap break-words">{text}</p>;
    }

    return (
      <div className="space-y-1.5">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <p key={`summary-${index}`} className="text-xs font-semibold uppercase tracking-[0.08em] opacity-90">
                {block.text}
              </p>
            );
          }

          if (block.type === 'bullet') {
            return (
              <p key={`summary-${index}`} className="text-sm leading-relaxed break-words">
                <span className="mr-2">-</span>
                {block.text}
              </p>
            );
          }

          return (
            <p key={`summary-${index}`} className="text-sm leading-relaxed break-words">
              {block.text}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 ${
      isDarkMode ? 'bg-[#050505] text-white' : 'bg-white text-gray-900'
    }`}>
      <Navbar
        variant="app"
        title="Workspace"
        compact
        actions={(
          <>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => {
                  setMenuOpen(!menuOpen);
                }}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-white hover:bg-white/10'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="More actions"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {menuOpen && (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50 transition-colors duration-300 ${
                  isDarkMode
                    ? 'bg-[#1a1a1a] border border-white/10'
                    : 'bg-white border border-gray-200'
                }`}>
                  <button
                    onClick={exportAsZip}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors rounded-t-lg ${
                      isDarkMode
                        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Export as zip
                  </button>
                  <button className={`w-full text-left px-4 py-2 text-sm transition-colors rounded-b-lg border-t ${
                    isDarkMode
                      ? 'text-gray-300 hover:bg-white/5 hover:text-white border-white/5'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-gray-200'
                  }`}>
                    Link to github
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      />

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 overflow-hidden flex" id="workspace-shell">
        <aside className={`${isSidebarOpen ? 'w-72' : 'w-2'} relative overflow-visible border-r flex flex-col transition-all duration-300 ${
          isDarkMode ? 'bg-[#070707] border-white/5' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`absolute ${isSidebarOpen ? '-right-3' : '-right-6'} top-6 z-20 w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
              isDarkMode
                ? 'bg-[#0f0f10] border-white/15 text-gray-300 hover:text-white hover:bg-[#171719]'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>

          {isSidebarOpen && (
          <div className="border-b border-white/5 p-4 space-y-3">
            {
              <>
                <div>
                  <p className={`text-[11px] uppercase tracking-[0.2em] font-semibold ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-500'
                  }`}>Projects</p>
                  <h2 className={`mt-2 text-lg font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>Workspace</h2>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  {loadingProjects ? 'Loading projects...' : 'First save asks for project name.'}
                </p>
              </>
            }
          </div>
          )}

          {isSidebarOpen && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <button
                onClick={startNewChat}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                  !currentProjectId
                    ? isDarkMode
                      ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300'
                      : 'bg-cyan-50 border-cyan-300 text-cyan-700'
                    : isDarkMode
                    ? 'bg-white/0 border-white/5 text-gray-300 hover:bg-white/5'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4" />
                  <span className="text-sm font-medium">New Chat</span>
                </div>
              </button>
            

            {projects.length === 0 ? (
                <div className={`rounded-lg border border-dashed p-4 text-sm ${
                  isDarkMode ? 'border-white/10 text-gray-500' : 'border-gray-300 text-gray-500'
                }`}>
                  No projects yet.
                </div>
            ) : (
              projects.map((project) => {
                const statusMeta = getProjectStatusMeta(projectStatuses[project.id] || 'idle');

                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg border transition-all flex items-center gap-2 ${
                      currentProjectId === project.id
                        ? isDarkMode
                          ? 'bg-indigo-500/15 border-indigo-500/50 text-white'
                          : 'bg-indigo-50 border-indigo-200 text-gray-900'
                        : isDarkMode
                        ? 'bg-white/0 border-white/5 text-gray-300 hover:bg-white/5'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    title={project.name}
                  >
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{project.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {currentProjectId === project.id && (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-400">Active</span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
                            isDarkMode ? 'bg-white/5 text-gray-200 border border-white/10' : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                      <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {project.last_opened_at ? new Date(project.last_opened_at).toLocaleString() : 'Recently updated'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          )}

          {isSidebarOpen && (
            <div className={`border-t p-4 text-xs ${isDarkMode ? 'border-white/5 text-gray-500' : 'border-gray-200 text-gray-600'}`}>
              {currentProjectId ? 'Opened project workspace' : 'New chat is active'}
            </div>
          )}
        </aside>

      <div className="flex-1 overflow-hidden" id="panels-container">
        <div className="flex h-full">
          {/* Chat Panel */}
          <div style={{ width: `${chatWidth}%` }} className={`flex flex-col border-r transition-colors duration-300 ${
            isDarkMode ? 'bg-[#050505] border-white/5' : 'bg-gray-50 border-gray-200'
          }`}>
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="space-y-3">
                    <h2 className={`text-lg font-semibold transition-colors duration-300 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>Start Coding</h2>
                    <p className={`text-xs max-w-xs transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
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
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm transition-colors duration-300 ${
                          message.sender === 'user'
                            ? isDarkMode
                              ? 'bg-indigo-500/20 border border-indigo-500/50 text-white'
                              : 'bg-indigo-100 border border-indigo-300 text-indigo-900'
                            : isDarkMode
                            ? 'bg-gray-800/50 border border-gray-700/50 text-gray-100'
                            : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                      >
                        {message.sender === 'bot' && message.explanation
                          ? renderFormattedSummary(message.explanation)
                          : <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                        <span className={`text-xs mt-1 block transition-colors duration-300 ${
                          isDarkMode ? 'text-gray-500' : 'text-gray-400'
                        }`}>
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
                      <div className={`px-3 py-2 rounded-lg transition-colors duration-300 ${
                        isDarkMode 
                          ? 'bg-gray-800/50 border border-gray-700/50' 
                          : 'bg-white border border-gray-300'
                      }`}>
                        <div className="flex gap-2">
                          <div className={`w-2 h-2 rounded-full animate-bounce transition-colors duration-300 ${
                            isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                          }`}></div>
                          <div className={`w-2 h-2 rounded-full animate-bounce transition-colors duration-300 ${
                            isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                          }`} style={{ animationDelay: '0.2s' }}></div>
                          <div className={`w-2 h-2 rounded-full animate-bounce transition-colors duration-300 ${
                            isDarkMode ? 'bg-gray-500' : 'bg-gray-400'
                          }`} style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className={`border-t backdrop-blur-lg px-4 py-3 transition-colors duration-300 ${
              isDarkMode ? 'border-white/5 bg-[#050505]/80' : 'border-gray-200 bg-white/80'
            }`}>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={loading}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all disabled:opacity-50 ${
                    isDarkMode 
                      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10' 
                      : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:bg-white'
                  }`}
                />
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setUseDeepSearch((prev) => !prev)}
                    disabled={loading}
                    title={useDeepSearch ? 'Deep Search is ON (Tavily).' : 'Default Vector Search is ON.'}
                    aria-label={useDeepSearch ? 'Deep search is on. Click to switch to default vector search' : 'Default vector search is on. Click to switch to deep Tavily search'}
                    className={`rounded-lg px-3 py-2 border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      useDeepSearch
                        ? isDarkMode
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30'
                          : 'bg-cyan-100 border-cyan-400 text-cyan-700 hover:bg-cyan-200'
                        : isDarkMode
                        ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {useDeepSearch ? <Globe className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                  </button>
                  <span className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDarkMode
                      ? 'bg-gray-900 text-gray-100 border border-gray-700'
                      : 'bg-white text-gray-800 border border-gray-300'
                  }`}>
                    {useDeepSearch ? 'Mode: Deep Search (Tavily)' : 'Mode: Default Vector Search'}
                  </span>
                </div>
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
            className={`w-3 cursor-col-resize transition-colors flex items-center justify-center ${
              isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <span className={`w-1.5 h-6 rounded-full ${
              isDarkMode ? 'bg-white/70' : 'bg-gray-400'
            }`}></span>
          </div>

          {/* Right Panels Container - Render and Coding stacked vertically */}
          <div style={{ width: `${rightPanelWidth}%` }} className="flex flex-col" id="right-panels">
            {/* Render Window Panel */}
            <div style={{ height: `${renderHeight}%` }} className={`flex flex-col border-b overflow-hidden transition-colors duration-300 ${
              isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-gray-100 border-gray-200'
            }`}>
              {/* Render Window Header */}
              <div className={`border-b px-4 py-2 flex items-center justify-between transition-colors duration-300 ${
                isDarkMode ? 'bg-[#0a0a0a]/80 border-white/5' : 'bg-gray-50/80 border-gray-200'
              }`}>
                <span className={`text-xs font-semibold uppercase transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Preview</span>
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
                    <p className={`text-sm transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Starting dev server...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className={`text-sm font-medium transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Render Window</p>
                    <p className={`text-xs mt-2 transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-600' : 'text-gray-500'
                    }`}>Generated code will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Resize Handle - Render/Coding */}
            <div
              onMouseDown={handleMouseDownRender}
              className={`h-3 cursor-row-resize transition-colors flex items-center justify-center ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              <span className={`w-6 h-1.5 rounded-full ${
                isDarkMode ? 'bg-white/70' : 'bg-gray-400'
              }`}></span>
            </div>

            {/* Code and File Window Panel */}
            <div style={{ height: `${codingHeight}%` }} className={`flex flex-col overflow-hidden transition-colors duration-300 ${
              isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-100'
            }`} id="code-panel">
              <div className="flex h-full">
                {/* File Tree */}
                <div style={{ width: `${fileTreeWidth}px` }} className={`border-r overflow-y-auto flex-shrink-0 transition-colors duration-300 ${
                  isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="p-2">
                    <p className={`text-xs font-semibold uppercase mb-2 transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>Files</p>
                    {Object.keys(files).length > 0 ? (
                      <div className="space-y-0.5">
                        {renderFileTree(fileTree)}
                      </div>
                    ) : (
                      <p className={`text-xs transition-colors duration-300 ${
                        isDarkMode ? 'text-gray-600' : 'text-gray-500'
                      }`}>No files yet</p>
                    )}
                  </div>
                </div>

                {/* Resize Handle - File Tree/Code */}
                <div
                  onMouseDown={handleMouseDownFileTree}
                  className={`w-1 cursor-col-resize transition-colors ${
                    isDarkMode ? 'bg-white/5 hover:bg-indigo-500/50' : 'bg-gray-200 hover:bg-indigo-400'
                  }`}
                />

                {/* Code Editor */}
                <div className={`flex-1 overflow-hidden flex flex-col transition-colors duration-300 ${
                  isDarkMode ? 'bg-[#050505]' : 'bg-white'
                }`}>
                  {activeFile && files[activeFile] ? (
                    <>
                      {/* File Header */}
                      <div className={`border-b px-3 py-2 transition-colors duration-300 ${
                        isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-xs font-mono transition-colors duration-300 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>{activeFile}</span>
                          <span className={`text-[11px] font-medium ${
                            isSaving ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {isSaving ? 'Saving...' : 'Saved ✓'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Code Editor Area */}
                      <textarea
                        value={fileContent}
                        onChange={(e) => handleCodeEdit(e.target.value)}
                        className={`flex-1 p-4 text-xs font-mono border-none outline-none resize-none transition-colors duration-300 ${
                          isDarkMode ? 'text-gray-300 bg-[#050505]' : 'text-gray-900 bg-white'
                        }`}
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
                      <p className={`text-sm transition-colors duration-300 ${
                        isDarkMode ? 'text-gray-600' : 'text-gray-500'
                      }`}>{currentProjectId ? 'Select a file to view and edit code' : 'Create a project to start editing'}</p>
                    </div>
                  )}
                </div>
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
          isDarkMode={isDarkMode}
          isOpen={editorPanelOpen && visualEditingEnabled}
        />
      </div>
    </div>
  );
};

export default Chat;