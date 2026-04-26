import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Sun, Moon, ArrowLeft, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import useThemeMode from '../hooks/useThemeMode';

const API_BASE = 'http://localhost:8000';

const relationColors = {
  INTERESTED_IN: '#60a5fa',
  CONTAINS: '#c084fc',
  IMPLEMENTED: '#34d399',
  STUDIED: '#fbbf24',
};

const nodeColors = {
  User: '#a3e635',
  TechStack: '#f472b6',
  Concept: '#38bdf8',
};

const buildGraphLayout = (graphData) => {
  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  const users = nodes.filter((node) => node.type === 'User');
  const techs = nodes.filter((node) => node.type === 'TechStack');
  const concepts = nodes.filter((node) => node.type === 'Concept');

  const laneGap = 250;
  const startX = 140;
  const baseY = 90;
  const spacingY = 70;

  if (nodes.length === 0) {
    return {
      nodes: [],
      links: [],
      width: 760,
      height: 460,
    };
  }

  const placeInLane = (items, laneIndex) => {
    const x = startX + laneIndex * laneGap;
    const totalHeight = Math.max((items.length - 1) * spacingY, 0);
    const startY = baseY + Math.max(0, (360 - totalHeight) / 2);

    return items.map((item, index) => ({
      ...item,
      x,
      y: startY + index * spacingY,
    }));
  };

  const laidOutNodes = [
    ...placeInLane(users, 0),
    ...placeInLane(techs, 1),
    ...placeInLane(concepts, 2),
  ];

  const positionById = Object.fromEntries(laidOutNodes.map((node) => [node.id, node]));
  const laidOutLinks = links
    .map((link) => ({
      ...link,
      sourceNode: positionById[link.source],
      targetNode: positionById[link.target],
    }))
    .filter((link) => link.sourceNode && link.targetNode);

  return {
    nodes: laidOutNodes,
    links: laidOutLinks,
    width: 760,
    height: 460,
  };
};

const Profile = () => {
  const navigate = useNavigate();
  const { isDarkMode, setIsDarkMode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [], stats: null });
  const [graphError, setGraphError] = useState('');
  const [relationFilters, setRelationFilters] = useState({
    INTERESTED_IN: true,
    CONTAINS: true,
    IMPLEMENTED: true,
    STUDIED: true,
  });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [isDraggingGraph, setIsDraggingGraph] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const fetchProfile = async () => {
      try {
        const [profileResponse, graphResponse] = await Promise.all([
          fetch(`${API_BASE}/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_BASE}/me/knowledge-graph`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (profileResponse.status === 401 || graphResponse.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          navigate('/');
          return;
        }

        if (!profileResponse.ok) {
          throw new Error('Unable to fetch profile details');
        }

        const profilePayload = await profileResponse.json();
        setProfile(profilePayload);

        if (graphResponse.ok) {
          const graphPayload = await graphResponse.json();
          setGraphData({
            nodes: graphPayload.nodes || [],
            links: graphPayload.links || [],
            stats: graphPayload.stats || null,
          });
        } else {
          setGraphError('Knowledge graph is currently unavailable.');
        }
      } catch (requestError) {
        setError(requestError.message || 'Unable to fetch profile details');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const filteredLinks = useMemo(() => {
    const links = graphData?.links || [];
    return links.filter((link) => relationFilters[link.type]);
  }, [graphData, relationFilters]);

  const filteredNodes = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const visibleNodeIds = new Set();

    filteredLinks.forEach((link) => {
      visibleNodeIds.add(link.source);
      visibleNodeIds.add(link.target);
    });

    // Keep user node visible for context even if filters hide all links.
    return nodes.filter((node) => visibleNodeIds.has(node.id) || node.type === 'User');
  }, [graphData, filteredLinks]);

  const graphLayout = useMemo(() => {
    return buildGraphLayout({ nodes: filteredNodes, links: filteredLinks });
  }, [filteredNodes, filteredLinks]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return (graphData?.nodes || []).find((node) => node.id === selectedNodeId) || null;
  }, [graphData, selectedNodeId]);

  const selectedNodeRelations = useMemo(() => {
    if (!selectedNodeId) {
      return [];
    }
    return (graphData?.links || []).filter(
      (link) => link.source === selectedNodeId || link.target === selectedNodeId
    );
  }, [graphData, selectedNodeId]);

  const clampZoom = (value) => Math.min(2.5, Math.max(0.5, value));

  const zoomGraph = (factor) => {
    setViewport((prev) => ({
      ...prev,
      scale: clampZoom(prev.scale * factor),
    }));
  };

  const resetGraphView = () => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const handleGraphMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    setIsDraggingGraph(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleGraphMouseMove = (event) => {
    if (!isDraggingGraph) {
      return;
    }

    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;

    dragStartRef.current = { x: event.clientX, y: event.clientY };
    setViewport((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }));
  };

  const handleGraphMouseUp = () => {
    setIsDraggingGraph(false);
  };

  const toggleRelationFilter = (relation) => {
    setRelationFilters((prev) => ({
      ...prev,
      [relation]: !prev[relation],
    }));
  };

  const dobValue = useMemo(() => {
    if (!profile?.dob) {
      return 'Not provided';
    }

    const date = new Date(profile.dob);
    if (Number.isNaN(date.getTime())) {
      return profile.dob;
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }, [profile]);

  const profileRows = [
    { label: 'First Name', value: profile?.first_name || 'Not provided' },
    { label: 'Last Name', value: profile?.last_name || 'Not provided' },
    { label: 'Date of Birth', value: dobValue },
    { label: 'Profession', value: profile?.profession || 'Not provided' },
    { label: 'Email', value: profile?.email || 'Not provided' },
  ];

  const graphStats = [
    { label: 'Tech Stacks', value: graphData?.stats?.tech_stacks ?? 0 },
    { label: 'Concepts', value: graphData?.stats?.concepts ?? 0 },
    { label: 'Relationships', value: graphData?.stats?.relationships ?? 0 },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Navbar variant="app" title="Profile" backTo="/chat" />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div
          className={`rounded-3xl border shadow-xl p-8 transition-colors duration-300 ${
            isDarkMode ? 'bg-[#0c0c0d] border-white/10 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200/60'
          }`}
        >
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className={`h-6 w-52 rounded ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
              <div className={`h-4 w-72 rounded ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
              <div className={`h-32 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`} />
            </div>
          )}

          {!loading && error && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                isDarkMode ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-red-300 bg-red-50 text-red-700'
              }`}
            >
              {error}
            </div>
          )}

          {!loading && !error && profile && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {profile.first_name} {profile.last_name}
                  </h2>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Manage your account details.</p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    profile.is_verified
                      ? isDarkMode
                        ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : isDarkMode
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-300/30'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  <BadgeCheck className="w-4 h-4" />
                  {profile.is_verified ? 'Verified Account' : 'Verification Pending'}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {profileRows.map((row) => (
                  <div
                    key={row.label}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{row.label}</p>
                    <p className="mt-2 text-base font-medium break-words">{row.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold tracking-tight">Knowledge Graph</h3>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Synced from Neo4j Aura</p>
                </div>

                {graphError && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm mb-4 ${
                      isDarkMode ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-red-300 bg-red-50 text-red-700'
                    }`}
                  >
                    {graphError}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3 mb-5">
                  {graphStats.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{item.label}</p>
                      <p className="mt-2 text-xl font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {Object.entries(relationColors).map(([relation, color]) => {
                    const isEnabled = relationFilters[relation];
                    return (
                      <button
                        key={relation}
                        type="button"
                        onClick={() => toggleRelationFilter(relation)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-all ${
                          isEnabled
                            ? isDarkMode
                              ? 'border-white/20 bg-white/10 text-white'
                              : 'border-gray-300 bg-white text-gray-900'
                            : isDarkMode
                              ? 'border-white/10 bg-transparent text-gray-500'
                              : 'border-gray-200 bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span style={{ backgroundColor: color }} className="w-2.5 h-2.5 rounded-full" />
                        {relation}
                      </button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => zoomGraph(0.9)}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-base font-semibold border ${
                        isDarkMode ? 'border-white/15 text-gray-200 hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      aria-label="Zoom out"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomGraph(1.1)}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-base font-semibold border ${
                        isDarkMode ? 'border-white/15 text-gray-200 hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                      aria-label="Zoom in"
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={resetGraphView}
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        isDarkMode ? 'border-white/15 text-gray-200 hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Reset View
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-4 overflow-auto max-h-[560px] ${
                    isDarkMode ? 'border-white/10 bg-[#080809]' : 'border-gray-200 bg-gray-50'
                  }`}
                  onMouseDown={handleGraphMouseDown}
                  onMouseMove={handleGraphMouseMove}
                  onMouseUp={handleGraphMouseUp}
                  onMouseLeave={handleGraphMouseUp}
                >
                  {graphLayout.nodes.length === 0 ? (
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                      No graph data yet. Generate a project to populate your knowledge graph.
                    </p>
                  ) : (
                    <svg
                      width={graphLayout.width}
                      height={graphLayout.height}
                      viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                      className={isDraggingGraph ? 'cursor-grabbing select-none' : 'cursor-grab select-none'}
                    >
                      <g transform={`translate(${viewport.offsetX}, ${viewport.offsetY}) scale(${viewport.scale})`}>
                        {graphLayout.links.map((link, index) => (
                          <line
                            key={`${link.source}-${link.target}-${link.type}-${index}`}
                            x1={link.sourceNode.x}
                            y1={link.sourceNode.y}
                            x2={link.targetNode.x}
                            y2={link.targetNode.y}
                            stroke={relationColors[link.type] || '#94a3b8'}
                            strokeOpacity="0.65"
                            strokeWidth={link.type === 'IMPLEMENTED' || link.type === 'STUDIED' ? 2 : 1.4}
                          />
                        ))}

                        {graphLayout.nodes.map((node) => {
                          const isSelected = selectedNodeId === node.id;

                          return (
                            <g
                              key={node.id}
                              transform={`translate(${node.x}, ${node.y})`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedNodeId(node.id);
                              }}
                              className="cursor-pointer"
                            >
                              <circle
                                r={node.type === 'User' ? 16 : node.type === 'TechStack' ? 13 : 11}
                                fill={nodeColors[node.type] || '#94a3b8'}
                                fillOpacity={isSelected ? '1' : '0.92'}
                                stroke={isSelected ? (isDarkMode ? '#f8fafc' : '#111827') : 'transparent'}
                                strokeWidth={isSelected ? 2 : 0}
                              />
                              <text x={18} y={4} fontSize="12" fill={isDarkMode ? '#e5e7eb' : '#111827'}>
                                {node.name}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  )}
                </div>

                {selectedNode && (
                  <div
                    className={`mt-4 rounded-2xl border p-4 ${
                      isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.16em] text-gray-500">Selected Node</p>
                        <h4 className="text-lg font-semibold mt-1">{selectedNode.name}</h4>
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm mt-1`}>{selectedNode.type}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(null)}
                        className={`px-2.5 py-1 rounded-md text-xs border ${
                          isDarkMode ? 'border-white/15 text-gray-200 hover:bg-white/10' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Clear
                      </button>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-gray-500 mb-2">Connected Relationships</p>
                      {selectedNodeRelations.length === 0 ? (
                        <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>No connected relationships found.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedNodeRelations.map((link, index) => {
                            const otherId = link.source === selectedNode.id ? link.target : link.source;
                            const otherNode = (graphData?.nodes || []).find((node) => node.id === otherId);
                            const relationLabel = `${link.type} ${otherNode ? `• ${otherNode.name}` : ''}`;
                            return (
                              <span
                                key={`${link.source}-${link.target}-${link.type}-${index}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${
                                  isDarkMode ? 'bg-white/10 text-gray-200' : 'bg-white text-gray-700 border border-gray-200'
                                }`}
                              >
                                <span
                                  style={{ backgroundColor: relationColors[link.type] || '#94a3b8' }}
                                  className="w-2 h-2 rounded-full"
                                />
                                {relationLabel}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
