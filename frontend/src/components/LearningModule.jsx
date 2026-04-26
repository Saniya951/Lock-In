import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Circle,
  CheckCircle2,
  PlayCircle,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import useThemeMode from '../hooks/useThemeMode';

const contentFiles = import.meta.glob('../data/learning/*.json', { eager: true });

const learningPaths = [
  {
    id: 'frontend',
    title: 'Frontend (React)',
    description: 'Build polished interfaces, component systems, and responsive UX patterns with React.',
    estimatedDuration: '4-6 weeks',
  },
  {
    id: 'backend',
    title: 'Backend (Flask)',
    description: 'Design robust Flask APIs with authentication, database integration, and deployment basics.',
    estimatedDuration: '4-6 weeks',
  },
  {
    id: 'fullstack',
    title: 'Full Stack (React + Flask)',
    description: 'Connect frontend and backend into production-style workflows and end-to-end features.',
    estimatedDuration: '8-10 weeks',
  },
];

const preferenceOptions = ['text', 'video'];
const levelOptions = ['beginner', 'intermediate', 'advanced'];

const preferenceLabels = {
  text: 'Text',
  video: 'Video',
};

const levelLabels = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const resolveModulesForSelection = (pathId, level, learningPreference) => {
  const fileName = `${pathId}_${level}_${learningPreference}.json`;

  for (const [filePath, fileModule] of Object.entries(contentFiles)) {
    if (filePath.endsWith(fileName)) {
      return fileModule.default || [];
    }
  }

  return [];
};

const LearningModule = () => {
  const navigate = useNavigate();
  const { isDarkMode, setIsDarkMode } = useThemeMode();

  const [preferencesByPath, setPreferencesByPath] = useState({});
  const [ongoingPaths, setOngoingPaths] = useState([]);
  const [checkpointState, setCheckpointState] = useState({});
  const [activePathId, setActivePathId] = useState(null);
  const [activeModules, setActiveModules] = useState([]);
  const [expandedModuleIndex, setExpandedModuleIndex] = useState(null);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [pendingPathId, setPendingPathId] = useState(null);
  const [formPreference, setFormPreference] = useState('text');
  const [formLevel, setFormLevel] = useState('beginner');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // Preferences are intentionally session-only so the first-time form
    // appears again after each page refresh.
    localStorage.removeItem('learningPreferences');
    setPreferencesByPath({});

    // Ongoing state and checkpoint progress are intentionally session-only.
    localStorage.removeItem('ongoingPaths');
    localStorage.removeItem('learningCheckpointProgress');
    setOngoingPaths([]);
    setCheckpointState({});
  }, [navigate]);

  const activePath = useMemo(
    () => learningPaths.find((path) => path.id === activePathId) || null,
    [activePathId]
  );

  const getPathProgress = (pathId) => {
    const pathPreference = preferencesByPath[pathId];
    if (!pathPreference?.level || !pathPreference?.learningPreference) {
      return 0;
    }

    const modules = resolveModulesForSelection(
      pathId,
      pathPreference.level,
      pathPreference.learningPreference
    );

    const totalCheckpoints = modules.reduce((acc, module) => acc + (module.checkpoints?.length || 0), 0);
    if (!totalCheckpoints) {
      return 0;
    }

    let completedCheckpoints = 0;
    const pathCheckpointState = checkpointState[pathId] || {};

    modules.forEach((module, moduleIndex) => {
      const moduleCheckpointState = pathCheckpointState[moduleIndex] || {};
      module.checkpoints.forEach((_, checkpointIndex) => {
        if (moduleCheckpointState[checkpointIndex]) {
          completedCheckpoints += 1;
        }
      });
    });

    return Math.round((completedCheckpoints / totalCheckpoints) * 100);
  };

  const openPath = (pathId, selectedPreferences = null) => {
    const pathPreference = selectedPreferences || preferencesByPath[pathId];

    if (!pathPreference) {
      setPendingPathId(pathId);
      setFormPreference('text');
      setFormLevel('beginner');
      setShowPreferenceModal(true);
      return;
    }

    const modules = resolveModulesForSelection(
      pathId,
      pathPreference.level,
      pathPreference.learningPreference
    );

    setActivePathId(pathId);
    setActiveModules(modules);
    setExpandedModuleIndex(null);
  };

  const savePreferencesAndContinue = () => {
    if (!pendingPathId) {
      setShowPreferenceModal(false);
      return;
    }

    const nextPreferencesForPath = {
      learningPreference: formPreference,
      level: formLevel,
    };

    const updatedPreferenceMap = {
      ...preferencesByPath,
      [pendingPathId]: nextPreferencesForPath,
    };

    setPreferencesByPath(updatedPreferenceMap);

    const pathToOpen = pendingPathId;
    setPendingPathId(null);
    setShowPreferenceModal(false);
    openPath(pathToOpen, nextPreferencesForPath);
  };

  const startPath = (pathId) => {
    if (!ongoingPaths.includes(pathId)) {
      const updated = [...ongoingPaths, pathId];
      setOngoingPaths(updated);
    }
  };

  const resetPath = (pathId) => {
    setCheckpointState((prev) => {
      const next = { ...prev };
      delete next[pathId];
      return next;
    });

    setOngoingPaths((prev) => prev.filter((item) => item !== pathId));

    if (activePathId === pathId) {
      setExpandedModuleIndex(null);
    }
  };

  const isCheckpointChecked = (pathId, moduleIndex, checkpointIndex) => {
    return Boolean(checkpointState[pathId]?.[moduleIndex]?.[checkpointIndex]);
  };

  const toggleCheckpoint = (pathId, moduleIndex, checkpointIndex) => {
    setCheckpointState((prev) => {
      const existingValue = Boolean(prev[pathId]?.[moduleIndex]?.[checkpointIndex]);

      const next = {
        ...prev,
        [pathId]: {
          ...(prev[pathId] || {}),
          [moduleIndex]: {
            ...((prev[pathId] || {})[moduleIndex] || {}),
            [checkpointIndex]: !existingValue,
          },
        },
      };

      return next;
    });

    if (!ongoingPaths.includes(pathId)) {
      startPath(pathId);
    }
  };

  const renderContent = (module) => {
    if (module.content?.type === 'video') {
      return (
        <a
          href={module.content.value}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-2 font-medium ${
            isDarkMode ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-600'
          }`}
        >
          <PlayCircle className="w-4 h-4" />
          Open Video Lesson
        </a>
      );
    }

    return <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} leading-7`}>{module.content?.value}</p>;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Navbar variant="app" title="Learning Module" backTo="/chat" />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Available Paths</h2>
            {/* {activePathId && preferencesByPath[activePathId] && (
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                Learning style: {preferenceLabels[preferencesByPath[activePathId].learningPreference]} | Level: {levelLabels[preferencesByPath[activePathId].level]}
              </p>
            )} */}
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {learningPaths.map((path) => (
              <button
                key={path.id}
                onClick={() => openPath(path.id)}
                className={`text-left rounded-3xl border p-5 shadow-lg transition-all hover:-translate-y-1 ${
                  isDarkMode
                    ? 'border-white/10 bg-[#0d0d0f] hover:border-cyan-300/40 hover:shadow-cyan-500/10'
                    : 'border-gray-200 bg-white hover:border-cyan-400/60 hover:shadow-cyan-200/60'
                }`}
              >
                <h3 className="text-lg font-semibold">{path.title}</h3>
                <p className={`mt-2 text-sm leading-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {path.description}
                </p>
                <div className={`mt-5 inline-flex items-center gap-2 text-sm ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  <Clock3 className="w-4 h-4" />
                  {path.estimatedDuration}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Ongoing Paths</h2>
          {ongoingPaths.length === 0 ? (
            <div className={`rounded-2xl border border-dashed p-6 ${
              isDarkMode ? 'border-white/20 text-gray-400' : 'border-gray-300 text-gray-600'
            }`}>
              Start a learning path to see your progress here.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {ongoingPaths.map((pathId) => {
                const path = learningPaths.find((item) => item.id === pathId);
                if (!path) {
                  return null;
                }

                const progress = getPathProgress(pathId);
                return (
                  <div
                    key={`ongoing-${pathId}`}
                    className={`rounded-2xl border p-5 shadow-sm ${
                      isDarkMode ? 'border-white/10 bg-[#0d0d0f]' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{path.title}</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Progress updates as you complete checkpoints.
                        </p>
                      </div>
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                        {progress}%
                      </span>
                    </div>

                    <div className={`mt-4 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${progress}%` }} />
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => openPath(pathId)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        Resume Learning
                      </button>
                      <button
                        onClick={() => resetPath(pathId)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isDarkMode
                            ? 'bg-red-500/15 text-red-200 hover:bg-red-500/25'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        Reset Path
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {activePath && (
          <section className={`rounded-3xl border p-6 ${
            isDarkMode ? 'border-white/10 bg-[#0b0b0c]' : 'border-gray-200 bg-white'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Module Viewer
                </p>
                <h2 className="text-2xl font-semibold mt-2">{activePath.title}</h2>
              </div>

              <button
                onClick={() => startPath(activePath.id)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white font-medium hover:opacity-90 transition-all"
              >
                Start Path
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {activeModules.map((module, moduleIndex) => {
                const expanded = expandedModuleIndex === moduleIndex;
                return (
                  <div
                    key={`${module.moduleTitle}-${moduleIndex}`}
                    className={`rounded-2xl border overflow-hidden ${
                      isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedModuleIndex(expanded ? null : moduleIndex)}
                      className="w-full px-4 py-4 flex items-center justify-between text-left"
                    >
                      <div>
                        <h3 className="font-semibold">{module.moduleTitle}</h3>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {module.duration}
                        </p>
                      </div>
                      <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {expanded && (
                      <div className={`px-4 pb-4 pt-1 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                        <div className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <Clock3 className="w-4 h-4" />
                          Duration: {module.duration}
                        </div>

                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Checkpoints</p>
                          <ul className="space-y-2">
                            {module.checkpoints.map((checkpoint, checkpointIndex) => {
                              const checked = isCheckpointChecked(activePath.id, moduleIndex, checkpointIndex);
                              return (
                                <li key={`${checkpoint}-${checkpointIndex}`}>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={checked}
                                    onClick={() => toggleCheckpoint(activePath.id, moduleIndex, checkpointIndex)}
                                    className={`w-full flex items-center gap-2 text-sm cursor-pointer transition-colors ${
                                      isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                                    }`}
                                  >
                                    {checked ? (
                                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-cyan-400" />
                                    )}
                                    <span className={checked ? 'line-through opacity-80' : ''}>{checkpoint}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <div className={`mt-4 rounded-xl p-4 ${isDarkMode ? 'bg-[#050505]' : 'bg-white'} border ${
                          isDarkMode ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <p className={`mb-2 text-sm font-medium inline-flex items-center gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            <BookOpen className="w-4 h-4" />
                            Learning Content
                          </p>
                          {renderContent(module)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {showPreferenceModal && (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDarkMode ? 'bg-[#101012] border-white/10' : 'bg-white border-gray-200'
          }`}>
            <h3 className="text-xl font-semibold">Set Learning Preferences</h3>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              This path is new for you. Choose your format and level to curate modules.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Learning Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {preferenceOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setFormPreference(option)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        formPreference === option
                          ? isDarkMode
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                            : 'border-cyan-500 bg-cyan-50 text-cyan-900'
                          : isDarkMode
                            ? 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {preferenceLabels[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {levelOptions.map((level) => (
                    <button
                      key={level}
                      onClick={() => setFormLevel(level)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        formLevel === level
                          ? isDarkMode
                            ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                            : 'border-indigo-500 bg-indigo-50 text-indigo-900'
                          : isDarkMode
                            ? 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {levelLabels[level]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPreferenceModal(false);
                  setPendingPathId(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm ${
                  isDarkMode ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={savePreferencesAndContinue}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-cyan-400 hover:opacity-90"
              >
                Save and Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningModule;