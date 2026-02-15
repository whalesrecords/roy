'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { getDetailedPromoStats, DetailedPromoStats } from '@/lib/api';
import Link from 'next/link';

export default function PromoStatsPage() {
  const [stats, setStats] = useState<DetailedPromoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getDetailedPromoStats();
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
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4">
          <p className="text-danger font-medium">Error:</p>
          <p className="text-danger text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-content1 rounded-2xl border border-divider p-12 text-center">
          <p className="text-default-500">No stats available</p>
        </div>
      </div>
    );
  }

  const approvalRate =
    stats.total_submissions > 0
      ? ((stats.total_approvals / stats.total_submissions) * 100).toFixed(1)
      : '0';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Stats Promo</h1>
          <p className="text-default-500">Récapitulatif de vos campagnes promo</p>
        </div>

        <Link
          href="/promo/import"
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
        >
          Importer CSV
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-content1 rounded-2xl border border-divider p-4">
          <div className="text-sm font-medium text-default-500 mb-2">Total Submissions</div>
          <div className="text-3xl font-bold text-foreground">{stats.total_submissions}</div>
        </div>

        <div className="bg-success/10 rounded-2xl border border-success/20 p-4">
          <div className="text-sm font-medium text-success mb-2">Approvals</div>
          <div className="text-3xl font-bold text-success">{stats.total_approvals}</div>
          <div className="text-sm text-default-500 mt-1">{approvalRate}% approval rate</div>
        </div>

        <div className="bg-primary/10 rounded-2xl border border-primary/20 p-4">
          <div className="text-sm font-medium text-primary mb-2">Playlist Adds</div>
          <div className="text-3xl font-bold text-primary">{stats.total_playlists}</div>
        </div>

        <div className="bg-content1 rounded-2xl border border-divider p-4">
          <div className="text-sm font-medium text-default-500 mb-2">Listens</div>
          <div className="text-3xl font-bold text-foreground">{stats.total_listens}</div>
        </div>
      </div>

      {/* By source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-content1 rounded-2xl border border-divider p-4">
          <h2 className="text-lg font-semibold mb-4">Par Source</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_source).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-foreground capitalize">{source}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-content1 rounded-2xl border border-divider p-4">
          <h2 className="text-lg font-semibold mb-4">Par Action (SubmitHub)</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_action).length > 0 ? (
              Object.entries(stats.by_action).map(([action, count]) => (
                <div key={action} className="flex items-center justify-between">
                  <span className="text-foreground capitalize">{action}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-default-500 text-sm">No SubmitHub data</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats by Artist */}
      {stats.by_artist && stats.by_artist.length > 0 && (
        <div className="bg-content1 rounded-2xl border border-divider p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Stats par Artiste</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider text-left">
                  <th className="py-3 px-2 text-sm font-medium text-default-500">Artiste</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Submissions</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Écoutés</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Approuvés</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Playlists</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_artist.map((artist) => (
                  <tr key={artist.artist_id} className="border-b border-divider/50 hover:bg-content2 transition-colors">
                    <td className="py-3 px-2 font-medium text-foreground">{artist.artist_name}</td>
                    <td className="py-3 px-2 text-right text-foreground">{artist.total_submissions}</td>
                    <td className="py-3 px-2 text-right text-foreground">{artist.total_listened}</td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-success font-semibold">{artist.total_approved}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-primary font-semibold">{artist.total_playlists}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`font-semibold ${artist.approval_rate >= 30 ? 'text-success' : artist.approval_rate >= 15 ? 'text-warning' : 'text-default-500'}`}>
                        {artist.approval_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats by Album */}
      {stats.by_album && stats.by_album.length > 0 && (
        <div className="bg-content1 rounded-2xl border border-divider p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Stats par Album</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-divider text-left">
                  <th className="py-3 px-2 text-sm font-medium text-default-500">Album</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500">Artiste</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Submissions</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Écoutés</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Approuvés</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Playlists</th>
                  <th className="py-3 px-2 text-sm font-medium text-default-500 text-right">Taux</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_album.map((album, idx) => (
                  <tr key={album.release_upc || idx} className="border-b border-divider/50 hover:bg-content2 transition-colors">
                    <td className="py-3 px-2 font-medium text-foreground">{album.release_title}</td>
                    <td className="py-3 px-2 text-default-500">{album.artist_name}</td>
                    <td className="py-3 px-2 text-right text-foreground">{album.total_submissions}</td>
                    <td className="py-3 px-2 text-right text-foreground">{album.total_listened}</td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-success font-semibold">{album.total_approved}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-primary font-semibold">{album.total_playlists}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={`font-semibold ${album.approval_rate >= 30 ? 'text-success' : album.approval_rate >= 15 ? 'text-warning' : 'text-default-500'}`}>
                        {album.approval_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8 flex gap-4">
        <Link
          href="/promo/submissions"
          className="px-4 py-2 bg-content2 text-foreground rounded-xl hover:bg-content3 transition-colors"
        >
          View all submissions
        </Link>
      </div>
    </div>
  );
}
