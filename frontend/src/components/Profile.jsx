import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Sun, Moon, ArrowLeft, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useThemeMode from '../hooks/useThemeMode';

const API_BASE = 'http://localhost:8000';

const Profile = () => {
  const navigate = useNavigate();
  const { isDarkMode, setIsDarkMode } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/');
          return;
        }

        if (!response.ok) {
          throw new Error('Unable to fetch profile details');
        }

        const data = await response.json();
        setProfile(data);
      } catch (requestError) {
        setError(requestError.message || 'Unable to fetch profile details');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#050505] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur-lg transition-colors duration-300 ${
        isDarkMode ? 'bg-[#050505]/80 border-white/10' : 'bg-white/90 border-gray-200'
      }`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                isDarkMode ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold">Profile</h1>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-white/10'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className={`rounded-3xl border shadow-xl p-8 transition-colors duration-300 ${
          isDarkMode ? 'bg-[#0c0c0d] border-white/10 shadow-black/40' : 'bg-white border-gray-200 shadow-gray-200/60'
        }`}>
          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className={`h-6 w-52 rounded ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
              <div className={`h-4 w-72 rounded ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
              <div className={`h-32 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`} />
            </div>
          )}

          {!loading && error && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              isDarkMode ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-red-300 bg-red-50 text-red-700'
            }`}>
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
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                    Manage your account details.
                  </p>
                </div>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  profile.is_verified
                    ? isDarkMode
                      ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : isDarkMode
                      ? 'bg-amber-400/20 text-amber-200 border border-amber-300/30'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
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
                    <p className={`text-xs uppercase tracking-[0.16em] ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {row.label}
                    </p>
                    <p className="mt-2 text-base font-medium break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
