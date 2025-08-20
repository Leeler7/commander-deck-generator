'use client';

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
              ADMIN DASHBOARD
            </h1>
            <p className="mt-2 text-lg text-gray-600" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
              Big Deck Energy Administration
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card Database Explorer */}
          <Link href="/admin/database" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Database Explorer</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Search and explore the card database. View detailed card information, mechanics, and metadata.
              </p>
              <div className="text-blue-600 group-hover:text-blue-800 font-medium">
                Explore Cards →
              </div>
            </div>
          </Link>

          {/* Tag Editor */}
          <Link href="/admin/tags" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Tag Editor</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Edit and manage card tags and mechanics. Add or remove tags to improve deck generation algorithms.
              </p>
              <div className="text-green-600 group-hover:text-green-800 font-medium">
                Edit Tags →
              </div>
            </div>
          </Link>

          {/* Synergy Calculator */}
          <Link href="/admin/synergy" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Synergy Calculator</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Calculate synergy scores between commanders and cards. Test and debug the synergy algorithms.
              </p>
              <div className="text-purple-600 group-hover:text-purple-800 font-medium">
                Calculate Synergy →
              </div>
            </div>
          </Link>

          {/* Database Sync */}
          <Link href="/admin/sync" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-yellow-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Database Sync</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Sync the card database with external sources. Monitor sync status and update card data.
              </p>
              <div className="text-yellow-600 group-hover:text-yellow-800 font-medium">
                Manage Sync →
              </div>
            </div>
          </Link>

          {/* System Stats */}
          <Link href="/admin/stats" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">System Stats</h3>
              </div>
              <p className="text-gray-600 mb-4">
                View system statistics, performance metrics, and usage analytics for the application.
              </p>
              <div className="text-indigo-600 group-hover:text-indigo-800 font-medium">
                View Stats →
              </div>
            </div>
          </Link>

          {/* Tag Cleanup Tool */}
          <Link href="/admin/tag-cleanup" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Tag Cleanup</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Bulk remove generic or overused tags. Blacklisted tags auto-remove on sync.
              </p>
              <div className="text-red-600 group-hover:text-red-800 font-medium">
                Clean Tags →
              </div>
            </div>
          </Link>

          {/* Tag Builder Tool */}
          <Link href="/admin/tag-builder" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-emerald-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Tag Builder</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Mass add tags based on oracle text, colors, or type. Preview before applying.
              </p>
              <div className="text-emerald-600 group-hover:text-emerald-800 font-medium">
                Build Tags →
              </div>
            </div>
          </Link>

          {/* Database Manager */}
          <Link href="/admin/database-manager" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-cyan-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Database Manager</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Download, modify, and deploy database. Complete workflow for managing tags.
              </p>
              <div className="text-cyan-600 group-hover:text-cyan-800 font-medium">
                Manage Database →
              </div>
            </div>
          </Link>

          {/* Normalized Tag Manager */}
          <Link href="/admin/tag-manager" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-orange-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Normalized Tags</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Manage the new normalized tag structure with synergy weights. Create, edit, and delete unique tags.
              </p>
              <div className="text-orange-600 group-hover:text-orange-800 font-medium">
                Manage Tags →
              </div>
            </div>
          </Link>

          {/* Back to Main App */}
          <Link href="/" className="group">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-gray-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
                <h3 className="ml-4 text-xl font-semibold text-gray-900">Main App</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Return to the main Big Deck Energy application for deck generation and user features.
              </p>
              <div className="text-gray-600 group-hover:text-gray-800 font-medium">
                ← Back to App
              </div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  );
}