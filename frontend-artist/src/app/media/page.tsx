'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import LabelLogo from '@/components/layout/LabelLogo';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
  submithub: { label: 'SubmitHub', emoji: '📊' },
  groover: { label: 'Groover', emoji: '🎵' },
  manual: { label: 'Manuel', emoji: '✍️' },
};

const getBadgeColor = (status: string): string => {
  const lower = status.toLowerCase();
  if (lower.includes('approved') || lower.includes('accepted') || lower.includes('added') || lower.includes('playlist')) return 'bg-success/20 text-success';
  if (lower.includes('declined') || lower.includes('rejected') || lower.includes('not')) return 'bg-danger/20 text-danger';
  if (lower.includes('listen') || lower.includes('écouté')) return 'bg-primary/20 text-primary';
  return 'bg-content2 text-foreground';
};

// Auto-detect and render URLs as clickable links
function Linkify({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s,]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Parse sharing links into platform objects
function parseSharingLinks(link: string) {
  return link.split(',').map(url => url.trim()).filter(Boolean).map(url => {
    if (url.includes('spotify.com')) return { url, platform: 'Spotify', emoji: '🟢' };
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { url, platform: 'YouTube', emoji: '🔴' };
    if (url.includes('deezer.com')) return { url, platform: 'Deezer', emoji: '🟣' };
    if (url.includes('apple.com')) return { url, platform: 'Apple Music', emoji: '🍎' };
    if (url.includes('soundcloud.com')) return { url, platform: 'SoundCloud', emoji: '🟠' };
    if (url.includes('tidal.com')) return { url, platform: 'Tidal', emoji: '🌊' };
    return { url, platform: 'Link', emoji: '🔗' };
  });
}

interface TrackGroup {
  song_title: string;
  release_title: string | null;
  submissions: PromoSubmission[];
  approvedCount: number;
  totalCount: number;
  hasLinks: boolean;
}

export default function MediaPage() {
  const { artist, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  useEffect(() => {
    if (artist) loadData();
  }, [artist]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getArtistPromoSubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  // Group submissions by track
  const trackGroups = useMemo(() => {
    const groups: Record<string, TrackGroup> = {};
    for (const sub of submissions) {
      const key = sub.song_title;
      if (!groups[key]) {
        groups[key] = {
          song_title: sub.song_title,
          release_title: sub.release_title,
          submissions: [],
          approvedCount: 0,
          totalCount: 0,
          hasLinks: false,
        };
      }
      groups[key].submissions.push(sub);
      groups[key].totalCount++;
      const status = (sub.action || sub.decision || '').toLowerCase();
      if (status.includes('approved') || status.includes('accepted') || status.includes('added') || status.includes('playlist')) {
        groups[key].approvedCount++;
      }
      if (sub.sharing_link) groups[key].hasLinks = true;
    }
    return Object.values(groups).sort((a, b) => a.song_title.localeCompare(b.song_title));
  }, [submissions]);

  // Filter by search
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return trackGroups;
    const q = searchQuery.toLowerCase();
    return trackGroups.filter(t =>
      t.song_title.toLowerCase().includes(q) ||
      t.release_title?.toLowerCase().includes(q)
    );
  }, [trackGroups, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) return null;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Media & Promo</h1>
            <p className="text-sm text-secondary-500">{submissions.length} submissions &middot; {trackGroups.length} tracks</p>
          </div>
          <LabelLogo className="h-8 w-auto max-w-[80px] object-contain" />
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-4">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {submissions.length === 0 ? (
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
            {/* Search */}
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
                placeholder="Search by track or album..."
                className="w-full pl-10 pr-4 py-3 bg-background border border-divider rounded-2xl text-foreground placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <svg className="w-5 h-5 text-secondary-400 hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Track list */}
            <div className="space-y-3">
              {filteredTracks.map((track) => {
                const isExpanded = expandedTrack === track.song_title;
                return (
                  <div key={track.song_title} className="bg-background border border-divider rounded-2xl overflow-hidden">
                    {/* Track header - click to expand */}
                    <button
                      onClick={() => setExpandedTrack(isExpanded ? null : track.song_title)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-content2/50 transition-colors"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{track.song_title}</p>
                        {track.release_title && (
                          <p className="text-xs text-secondary-500 truncate">{track.release_title}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-secondary-500">{track.totalCount} submissions</span>
                          {track.approvedCount > 0 && (
                            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                              {track.approvedCount} approved
                            </span>
                          )}
                          {track.hasLinks && <span className="text-xs">🔗</span>}
                        </div>
                      </div>
                      <svg className={`w-5 h-5 text-secondary-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded submissions */}
                    {isExpanded && (
                      <div className="border-t border-divider divide-y divide-divider">
                        {track.submissions.map((sub) => {
                          const sourceInfo = SOURCE_LABELS[sub.source];
                          const outlet = sub.outlet_name || sub.influencer_name || 'Unknown';
                          const status = sub.action || sub.decision || 'Pending';

                          return (
                            <div key={sub.id} className="p-4 space-y-3">
                              {/* Submission header */}
                              <div className="flex items-start gap-3">
                                <span className="text-lg">{sourceInfo?.emoji || '📊'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground">{outlet}</p>
                                  {(sub.outlet_type || sub.influencer_type) && (
                                    <p className="text-xs text-secondary-500">{sub.outlet_type || sub.influencer_type}</p>
                                  )}
                                </div>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${getBadgeColor(status)}`}>
                                  {status}
                                </span>
                              </div>

                              {/* Dates */}
                              {sub.submitted_at && (
                                <p className="text-xs text-secondary-400">
                                  {new Date(sub.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}

                              {/* Feedback with auto-linked URLs */}
                              {sub.feedback && (
                                <div className="bg-content2/50 rounded-xl p-3">
                                  <p className="text-xs text-secondary-500 mb-1">Feedback</p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                    <Linkify text={sub.feedback} />
                                  </p>
                                </div>
                              )}

                              {/* Sharing links */}
                              {sub.sharing_link && (
                                <div className="flex flex-wrap gap-2">
                                  {parseSharingLinks(sub.sharing_link).map((link, i) => (
                                    <a
                                      key={i}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-full text-sm text-primary transition-colors"
                                    >
                                      <span>{link.emoji}</span>
                                      <span>{link.platform}</span>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Listen time */}
                              {sub.listen_time && (
                                <p className="text-xs text-secondary-400">
                                  Listened: {Math.floor(sub.listen_time / 60)}:{(sub.listen_time % 60).toString().padStart(2, '0')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredTracks.length === 0 && searchQuery && (
              <div className="text-center py-8 text-secondary-500">
                No tracks matching &quot;{searchQuery}&quot;
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
