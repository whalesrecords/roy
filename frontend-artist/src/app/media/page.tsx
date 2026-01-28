'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from '@heroui/react';
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
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<PromoSubmission | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

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

  const filteredSubmissions = submissions.filter(sub => {
    if (selectedTab === 'all') return true;
    return sub.source === selectedTab;
  });

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
    <>
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-foreground">Media & Promo</h1>
          <p className="text-sm text-secondary-500">Track your promo campaigns</p>
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

            {/* Source Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedTab('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedTab === 'all'
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
                    onClick={() => setSelectedTab(source)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedTab === source
                        ? 'bg-primary text-white'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    {info?.emoji} {info?.label || source} ({count})
                  </button>
                );
              })}
            </div>

            {/* Submissions List */}
            <div className="space-y-3">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  No submissions for this filter
                </div>
              ) : (
                filteredSubmissions.map((sub) => {
                  const sourceInfo = SOURCE_LABELS[sub.source];
                  const outlet = sub.outlet_name || sub.influencer_name || 'Unknown';
                  const status = sub.action || sub.decision || 'Pending';

                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedSubmission(sub);
                        onOpen();
                      }}
                      className="w-full bg-background border border-divider rounded-2xl p-4 text-left hover:border-primary/50 transition-colors"
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
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>

    {/* Submission Detail Modal */}
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
      >
        <ModalContent>
              <ModalHeader className="flex flex-col gap-1">
                <p className="text-lg font-bold">{selectedSubmission?.song_title}</p>
                <p className="text-sm text-secondary-500 font-normal">
                  {selectedSubmission?.outlet_name || selectedSubmission?.influencer_name}
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  {/* Source */}
                  <div>
                    <p className="text-xs text-secondary-500 uppercase mb-1">Source</p>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${SOURCE_LABELS[selectedSubmission?.source || '']?.color || 'from-gray-400 to-gray-500'} text-white text-sm font-medium`}>
                      {SOURCE_LABELS[selectedSubmission?.source || '']?.emoji} {SOURCE_LABELS[selectedSubmission?.source || '']?.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs text-secondary-500 uppercase mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getBadgeColor(selectedSubmission?.action || selectedSubmission?.decision || 'Pending')}`}>
                      {selectedSubmission?.action || selectedSubmission?.decision || 'Pending'}
                    </span>
                  </div>

                  {/* Dates */}
                  {selectedSubmission?.submitted_at && (
                    <div>
                      <p className="text-xs text-secondary-500 uppercase mb-1">Submitted</p>
                      <p className="text-sm text-foreground">
                        {new Date(selectedSubmission.submitted_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {/* Feedback */}
                  {selectedSubmission?.feedback && (
                    <div>
                      <p className="text-xs text-secondary-500 uppercase mb-1">Feedback</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedSubmission.feedback}</p>
                    </div>
                  )}

                  {/* Links */}
                  {(selectedSubmission?.campaign_url || selectedSubmission?.sharing_link) && (
                    <div>
                      <p className="text-xs text-secondary-500 uppercase mb-1">Links</p>
                      <div className="space-y-2">
                        {selectedSubmission.campaign_url && (
                          <a
                            href={selectedSubmission.campaign_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary hover:underline"
                          >
                            Campaign URL →
                          </a>
                        )}
                        {selectedSubmission.sharing_link && (
                          <a
                            href={selectedSubmission.sharing_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary hover:underline"
                          >
                            Sharing Link →
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
