'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';
import { Card, Eyebrow, Pill, fmtNum } from '@/components/roy/ui';
import { IconSearch, IconMusic, IconChevronRight } from '@/components/roy/icons';

const COVER = { background: 'var(--cover)' } as const;

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
  submithub: { label: 'SubmitHub', emoji: '📊' },
  groover: { label: 'Groover', emoji: '🎵' },
  manual: { label: 'Manuel', emoji: '✍️' },
};

const getBadgeTone = (status: string): 'accent' | 'neutral' | 'neg' => {
  const lower = status.toLowerCase();
  if (lower.includes('approved') || lower.includes('accepted') || lower.includes('added') || lower.includes('playlist')) return 'accent';
  if (lower.includes('declined') || lower.includes('rejected') || lower.includes('not')) return 'neg';
  if (lower.includes('listen') || lower.includes('écouté')) return 'accent';
  return 'neutral';
};

function StatusBadge({ status }: { status: string }) {
  const tone = getBadgeTone(status);
  if (tone === 'neg') {
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold bg-neg/10 text-neg">{status}</span>;
  }
  return <Pill tone={tone}>{status}</Pill>;
}

// Auto-detect and render URLs as clickable links
function Linkify({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s,]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">
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

  const searchBox = (full = false) => (
    <div className={`flex items-center gap-2.5 rounded-[14px] bg-surface border border-line px-3.5 py-2.5 ${full ? '' : 'w-[280px]'}`}>
      <IconSearch size={16} className="text-ink-faint" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by track or album…"
        className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      {searchQuery && (
        <button onClick={() => setSearchQuery('')} className="text-ink-faint hover:text-ink shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Media &amp; Promo</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} · {trackGroups.length} track{trackGroups.length !== 1 ? 's' : ''}
          </div>
        </div>
        {submissions.length > 0 && searchBox()}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto">
        {error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm mb-3">{error}</div>
        )}

        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
        ) : !artist ? null : (<>
          {/* Mobile header */}
          <div className="lg:hidden mb-4">
            <Eyebrow>Media &amp; Promo</Eyebrow>
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <div className="roy-num text-[44px] font-bold text-ink leading-none">{trackGroups.length}</div>
              <div className="text-[14px] text-ink-muted">track{trackGroups.length !== 1 ? 's' : ''} · {submissions.length} submissions</div>
            </div>
            {submissions.length > 0 && <div className="mt-5">{searchBox(true)}</div>}
          </div>

          {submissions.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-4">
                <IconMusic size={26} />
              </div>
              <h2 className="text-[16px] font-semibold text-ink mb-1.5">No promo data yet</h2>
              <p className="text-ink-faint text-[13px] max-w-sm">
                Your promo submissions will appear here once imported by your label.
              </p>
            </Card>
          ) : (
            <>
              {/* Track list */}
              <div className="space-y-3">
                {filteredTracks.map((track) => {
                  const isExpanded = expandedTrack === track.song_title;
                  return (
                    <Card key={track.song_title} padded={false} className="overflow-hidden">
                      {/* Track header - click to expand */}
                      <button
                        onClick={() => setExpandedTrack(isExpanded ? null : track.song_title)}
                        className="w-full p-4 flex items-center gap-3.5 text-left hover:bg-surface-2 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 text-accent" style={COVER}>
                          <IconMusic size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ink truncate">{track.song_title}</p>
                          {track.release_title && (
                            <p className="text-[11.5px] text-ink-faint truncate">{track.release_title}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11.5px] text-ink-faint">{track.totalCount} submissions</span>
                            {track.approvedCount > 0 && <Pill tone="accent">{track.approvedCount} approved</Pill>}
                            {track.hasLinks && <span className="text-[11px]">🔗</span>}
                          </div>
                        </div>
                        <IconChevronRight
                          size={18}
                          className={`text-ink-faint transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Expanded submissions */}
                      {isExpanded && (
                        <div className="border-t border-line divide-y divide-line">
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
                                    <p className="font-medium text-ink">{outlet}</p>
                                    {(sub.outlet_type || sub.influencer_type) && (
                                      <p className="text-[11.5px] text-ink-faint">{sub.outlet_type || sub.influencer_type}</p>
                                    )}
                                  </div>
                                  <StatusBadge status={status} />
                                </div>

                                {/* Dates */}
                                {sub.submitted_at && (
                                  <p className="text-[11.5px] text-ink-faint">
                                    {new Date(sub.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                )}

                                {/* Feedback with auto-linked URLs */}
                                {sub.feedback && (
                                  <div className="bg-surface-2 rounded-xl p-3">
                                    <p className="text-[11px] roy-eyebrow mb-1">Feedback</p>
                                    <p className="text-[13px] text-ink whitespace-pre-wrap leading-relaxed">
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft hover:opacity-80 rounded-full text-[13px] text-accent font-semibold transition-opacity"
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
                                  <p className="text-[11.5px] text-ink-faint">
                                    Listened: {Math.floor(sub.listen_time / 60)}:{(sub.listen_time % 60).toString().padStart(2, '0')}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {filteredTracks.length === 0 && searchQuery && (
                <div className="text-center py-10 text-ink-faint text-sm">
                  No tracks matching &quot;{searchQuery}&quot;
                </div>
              )}
            </>
          )}
        </>)}
      </main>
    </div>
  );
}
