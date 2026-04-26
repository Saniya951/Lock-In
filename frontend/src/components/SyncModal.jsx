import React, { useState } from 'react';
import { X, Github, Loader2 } from 'lucide-react';

const SyncModal = ({ onClose, onSync, isDarkMode = false }) => {
  const [repoName, setRepoName] = useState('my-ai-project');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`p-8 rounded-2xl w-full max-w-md shadow-2xl border ${
          isDarkMode
            ? 'bg-[#111] border-white/10'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2
            className={`text-xl font-bold flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            <Github /> Sync to GitHub
          </h2>
          <button onClick={onClose}>
            <X
              className={`transition-colors ${
                isDarkMode
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            />
          </button>
        </div>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Enter a name for your new private repository.
        </p>
        <input 
          type="text" 
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          className={`w-full rounded-lg p-3 mb-6 focus:outline-none focus:border-indigo-500 transition-colors ${
            isDarkMode
              ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500'
              : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
          placeholder="repo-name"
        />
        <button 
          onClick={() => { setLoading(true); onSync(repoName); }}
          disabled={loading}
          className={`w-full py-3 font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
            isDarkMode
              ? 'bg-white text-black hover:bg-gray-200'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Create and Push Repo'}
        </button>
      </div>
    </div>
  );
};

export default SyncModal;