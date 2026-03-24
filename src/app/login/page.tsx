'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeMsg, setChangeMsg] = useState('');
  const [changeError, setChangeError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setChangeMsg('');

    if (newPassword !== confirmPassword) {
      setChangeError('New passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      setChangeError('Password must be at least 4 characters');
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChangeError(data.error || 'Failed to change password');
        return;
      }

      setChangeMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowChangePassword(false), 1500);
    } catch {
      setChangeError('Network error');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    color: '#1E293B',
    transition: 'border-color 0.15s',
  };

  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ background: '#F5F7FA' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: '#1E293B', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Penma
          </h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {showChangePassword ? 'Change your password' : 'Sign in to continue'}
          </p>
        </div>

        {!showChangePassword ? (
          /* ── Login Form ── */
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="admin"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-center" style={{ color: '#EF4444' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              style={{ background: '#3B82F6', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#2563EB'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6'; }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="text-xs cursor-pointer"
              style={{ color: '#94A3B8', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#3B82F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
            >
              Change password
            </button>
          </form>
        ) : (
          /* ── Change Password Form ── */
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="admin"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="At least 4 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-10 px-3 text-sm focus:outline-none focus:border-[#3B82F6]"
                style={inputStyle}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
            </div>

            {changeError && (
              <p className="text-xs text-center" style={{ color: '#EF4444' }}>{changeError}</p>
            )}
            {changeMsg && (
              <p className="text-xs text-center" style={{ color: '#22C55E' }}>{changeMsg}</p>
            )}

            <button
              type="submit"
              className="h-10 rounded-lg text-sm font-medium text-white cursor-pointer"
              style={{ background: '#3B82F6', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2563EB'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#3B82F6'; }}
            >
              Change password
            </button>

            <button
              type="button"
              onClick={() => { setShowChangePassword(false); setChangeError(''); setChangeMsg(''); }}
              className="text-xs cursor-pointer"
              style={{ color: '#94A3B8', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#3B82F6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
