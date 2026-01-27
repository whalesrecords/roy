'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { getPromoStats, PromoStats } from '@/lib/api';
import Link from 'next/link';

export default function PromoStatsPage() {
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getPromoStats();
      setStats(data);
    } catch (err: any) {
      console.error('Error loading promo stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No stats available</p>
        </div>
      </div>
    );
  }

  const approvalRate =
    stats.total_submissions > 0
      ? ((stats.total_approvals / stats.total_submissions) * 100).toFixed(1)
      : '0';

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Stats Promo</h1>
          <p className="text-gray-600">Récapitulatif de vos campagnes promo</p>
        </div>

        <Link
          href="/promo/import"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Importer CSV
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Submissions</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total_submissions}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Approvals</div>
          <div className="text-3xl font-bold text-green-600">{stats.total_approvals}</div>
          <div className="text-sm text-gray-500 mt-1">{approvalRate}% approval rate</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Playlist Adds</div>
          <div className="text-3xl font-bold text-purple-600">{stats.total_playlists}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Listens</div>
          <div className="text-3xl font-bold text-blue-600">{stats.total_listens}</div>
        </div>
      </div>

      {/* By source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Par Source</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_source).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-gray-700 capitalize">{source}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Par Action (SubmitHub)</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_action).length > 0 ? (
              Object.entries(stats.by_action).map(([action, count]) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-gray-700 capitalize">{action}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No SubmitHub data</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/promo/submissions"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          View all submissions
        </Link>
      </div>
    </div>
  );
}
