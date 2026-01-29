'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import LabelLogo from '@/components/layout/LabelLogo';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistPromoStats, getArtistPromoSubmissions, PromoStats, PromoSubmission } from '@/lib/api';

// Source labels with colors
const SOURCE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  submithub: { label: 'SubmitHub', emoji: '📊', color: 'from-blue-500 to-blue-600' },
  groover: { label: 'Groover', emoji: '🎵', color: 'from-purple-500 to-purple-600' },
  manual: { label: 'Manuel', emoji: '✍️', color: 'from-gray-500 to-gray-600' },
};

// Action/decision badges
const getBadgeColor = (status: string): string => {
  const lower = status.toLowerCase();
  if (lower.includes('approved') || lower.includes('accepted') || lower.includes('added')) return 'bg-success/20 text-success';
  if (lower.includes('declined') || lower.includes('rejected')) return 'bg-danger/20 text-danger';
  if (lower.includes('listen')) return 'bg-primary/20 text-primary';
  if (lower.includes('playlist')) return 'bg-purple-500/20 text-purple-600';
  return 'bg-content2 text-foreground';
};

export default function MediaPage() {
  const { artist, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceTab, setSelectedSourceTab] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (artist) {
      loadPromoData();
    }
  }, [artist]);

  const loadPromoData = async () => {
    try {
      setLoading(true);
      const [statsData, submissionsData] = await Promise.all([
        getArtistPromoStats(),
        getArtistPromoSubmissions(),
      ]);
      setStats(statsData);
      setSubmissions(submissionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (sub: PromoSubmission): string => {
    const status = (sub.action || sub.decision || '').toLowerCase();
    if (status.includes('approved') || status.includes('accepted') || status.includes('added')) return 'approved';
    if (status.includes('declined') || status.includes('rejected')) return 'declined';
    if (status.includes('listen')) return 'listened';
    return 'pending';
  };

  const filteredSubmissions = submissions.filter(sub => {
    // Filter by source
    if (selectedSourceTab !== 'all' && sub.source !== selectedSourceTab) {
      return false;
    }
    // Filter by status
    if (selectedStatusTab !== 'all') {
      const status = getSubmissionStatus(sub);
      if (status !== selectedStatusTab) {
        return false;
      }
    }
    // Filter by search query (song title, outlet, influencer)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = sub.song_title.toLowerCase().includes(query);
      const matchesOutlet = sub.outlet_name?.toLowerCase().includes(query);
      const matchesInfluencer = sub.influencer_name?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesOutlet && !matchesInfluencer) {
        return false;
      }
    }
    return true;
  });

  // Group submissions by release_title (album), then sort by song_title
  type GroupedSubmissions = {
    [releaseTitle: string]: PromoSubmission[];
  };

  const groupedSubmissions: GroupedSubmissions = filteredSubmissions.reduce((acc, sub) => {
    const releaseTitle = sub.release_title || 'Unknown Album';
    if (!acc[releaseTitle]) {
      acc[releaseTitle] = [];
    }
    acc[releaseTitle].push(sub);
    return acc;
  }, {} as GroupedSubmissions);

  // Sort albums alphabetically, and songs within each album
  const sortedReleases = Object.keys(groupedSubmissions).sort((a, b) => {
    // Put "Unknown Album" at the end
    if (a === 'Unknown Album') return 1;
    if (b === 'Unknown Album') return -1;
    return a.localeCompare(b);
  });

  sortedReleases.forEach(releaseTitle => {
    groupedSubmissions[releaseTitle].sort((a, b) =>
      a.song_title.localeCompare(b.song_title)
    );
  });

  // Count submissions by status
  const statusCounts = {
    all: submissions.length,
    approved: submissions.filter(s => getSubmissionStatus(s) === 'approved').length,
    listened: submissions.filter(s => getSubmissionStatus(s) === 'listened').length,
    declined: submissions.filter(s => getSubmissionStatus(s) === 'declined').length,
    pending: submissions.filter(s => getSubmissionStatus(s) === 'pending').length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  const hasData = stats && stats.total_submissions > 0;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Media & Promo</h1>
            <p className="text-sm text-secondary-500">Track your promo campaigns</p>
          </div>
          <LabelLogo className="h-8 w-auto max-w-[80px] object-contain" />
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {!hasData ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No promo data yet</h2>
            <p className="text-secondary-500 mb-6 max-w-sm">
              Your promo submissions will appear here once imported by your label.
            </p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background border border-divider rounded-2xl p-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.total_submissions || 0}</p>
                <p className="text-sm text-secondary-500">Total Submissions</p>
              </div>

              <div className="bg-background border border-divider rounded-2xl p-4">
                <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.total_approvals || 0}</p>
                <p className="text-sm text-secondary-500">Approvals</p>
              </div>

              <div className="bg-background border border-divider rounded-2xl p-4">
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.total_playlists || 0}</p>
                <p className="text-sm text-secondary-500">Playlist Adds</p>
              </div>

              <div className="bg-background border border-divider rounded-2xl p-4">
                <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.total_shares || 0}</p>
                <p className="text-sm text-secondary-500">Shares</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by song, outlet, or influencer..."
                className="w-full pl-10 pr-4 py-3 bg-background border border-divider rounded-2xl text-foreground placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="w-5 h-5 text-secondary-400 hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div>
              <p className="text-xs text-secondary-500 uppercase mb-2 px-1">Filter by Status</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedStatusTab('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedStatusTab === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  All ({statusCounts.all})
                </button>
                <button
                  onClick={() => setSelectedStatusTab('approved')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedStatusTab === 'approved'
                      ? 'bg-success text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  ✓ Approved ({statusCounts.approved})
                </button>
                <button
                  onClick={() => setSelectedStatusTab('listened')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedStatusTab === 'listened'
                      ? 'bg-primary text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  👂 Listened ({statusCounts.listened})
                </button>
                <button
                  onClick={() => setSelectedStatusTab('declined')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedStatusTab === 'declined'
                      ? 'bg-danger text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  ✗ Declined ({statusCounts.declined})
                </button>
                <button
                  onClick={() => setSelectedStatusTab('pending')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedStatusTab === 'pending'
                      ? 'bg-warning text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  ⏳ Pending ({statusCounts.pending})
                </button>
              </div>
            </div>

            {/* Source Tabs */}
            <div>
              <p className="text-xs text-secondary-500 uppercase mb-2 px-1">Filter by Source</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedSourceTab('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedSourceTab === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-content2 text-secondary-600 hover:bg-content3'
                  }`}
                >
                  All ({submissions.length})
                </button>
                {Object.entries(stats?.by_source || {}).map(([source, count]) => {
                  const info = SOURCE_LABELS[source];
                  return (
                    <button
                      key={source}
                      onClick={() => setSelectedSourceTab(source)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedSourceTab === source
                          ? 'bg-primary text-white'
                          : 'bg-content2 text-secondary-600 hover:bg-content3'
                      }`}
                    >
                      {info?.emoji} {info?.label || source} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submissions List - Grouped by Album */}
            <div className="space-y-6">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  No submissions for this filter
                </div>
              ) : (
                sortedReleases.map((releaseTitle) => (
                  <div key={releaseTitle} className="space-y-3">
                    {/* Album Header */}
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-1 h-6 bg-primary rounded-full" />
                      <h3 className="text-lg font-bold text-foreground">{releaseTitle}</h3>
                      <span className="text-sm text-secondary-500">
                        ({groupedSubmissions[releaseTitle].length})
                      </span>
                    </div>

                    {/* Songs in this album */}
                    {groupedSubmissions[releaseTitle].map((sub) => {
                      const sourceInfo = SOURCE_LABELS[sub.source];
                      const outlet = sub.outlet_name || sub.influencer_name || 'Unknown';
                      const status = sub.action || sub.decision || 'Pending';

                      return (
                        <Link
                          key={sub.id}
                          href={`/media/${sub.id}`}
                          className="block w-full bg-background border border-divider rounded-2xl p-4 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-12 h-12 bg-gradient-to-br ${sourceInfo?.color || 'from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
                              {sourceInfo?.emoji || '📊'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{sub.song_title}</p>
                              <p className="text-sm text-secondary-500 truncate">{outlet}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBadgeColor(status)}`}>
                                  {status}
                                </span>
                                {sub.submitted_at && (
                                  <span className="text-xs text-secondary-400">
                                    {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-secondary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
