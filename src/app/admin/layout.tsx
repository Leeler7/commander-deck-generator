'use client';

import { useState, useEffect } from 'react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'your-secure-password-here';
const ADMIN_ENABLED = process.env.NEXT_PUBLIC_ADMIN_ENABLED !== 'false';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check if already authenticated on mount
  useEffect(() => {
    const authToken = localStorage.getItem('admin_auth');
    if (authToken === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', 'authenticated');
      setError('');
    } else {
      setError('Invalid password');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
    setPassword('');
  };

  // Check if admin is disabled
  if (!ADMIN_ENABLED) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Panel Disabled</h2>
          <p className="text-gray-600">The admin panel is currently disabled.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
              ADMIN ACCESS
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter password to access admin panel
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}
              >
                ACCESS ADMIN
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Logout button in header */}
      <div className="bg-gray-800 text-white p-2">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-sm">Admin Mode</span>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}