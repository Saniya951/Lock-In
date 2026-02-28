import React, { useState } from 'react';
import { X, Github, Loader2 } from 'lucide-react';

const SyncModal = ({ onClose, onSync }) => {
  const [repoName, setRepoName] = useState('my-ai-project');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111] border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Github /> Sync to GitHub</h2>
          <button onClick={onClose}><X className="text-gray-400 hover:text-white" /></button>
        </div>
        <p className="text-gray-400 text-sm mb-4">Enter a name for your new private repository.</p>
        <input 
          type="text" 
          value={repoName}
          onChange={(e) => setRepoName(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 mb-6 focus:outline-none focus:border-indigo-500"
          placeholder="repo-name"
        />
        <button 
          onClick={() => { setLoading(true); onSync(repoName); }}
          disabled={loading}
          className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Create and Push Repo'}
        </button>
      </div>
    </div>
  );
};

export default SyncModal;