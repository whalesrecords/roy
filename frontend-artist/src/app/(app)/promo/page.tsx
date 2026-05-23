'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewTab = 'articles' | 'playlists' | 'positifs' | 'negatifs';

const TAB_CONFIG: Array<{ key: ViewTab; label: string; emptyLabel: string }> = [
  { key: 'articles',  label: 'Articles',          emptyLabel: 'Aucun article / blog' },
  { key: 'playlists', label: 'Playlists',          emptyLabel: 'Aucune playlist' },
  { key: 'positifs',  label: 'Retours Positifs',   emptyLabel: 'Aucun retour positif' },
  { key: 'negatifs',  label: 'Retours Négatifs',   emptyLabel: 'Aucun retour négatif' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(str: string | null): string {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatListenTime(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${(s % 60).toString().padStart(2, '0')}s` : `${s}s`;
}

function outletType(sub: PromoSubmission): string {
  return ((sub.outlet_type || '') + ' ' + (sub.influencer_type || '')).toLowerCase();
}

function isArticle(sub: PromoSubmission): boolean {
  return /blog|webzine|press|radio|media|article|presse|revue|review|journal|magazine/.test(outletType(sub));
}

function isPlaylistSub(sub: PromoSubmission): boolean {
  return /playlist/.test(outletType(sub));
}

const NEGATIVE_WORDS = ['pass', 'declined', 'rejected', 'not added', 'no thanks', 'sorry', 'unfortunately', 'refuse', 'not a fit', 'no match'];
const POSITIVE_WORDS = ['playlist', 'added', 'approved', 'accepted', 'feature', 'share', 'on air', 'ajoute', 'yes!', 'included'];

function decisionText(sub: PromoSubmission): string {
  return ((sub.decision || '') + ' ' + (sub.action || '')).toLowerCase().trim();
}

function isPositive(sub: PromoSubmission): boolean {
  const t = decisionText(sub);
  if (!t) return false;
  if (NEGATIVE_WORDS.some(w => t.includes(w))) return false;
  return POSITIVE_WORDS.some(w => t.includes(w));
}

function isNegative(sub: PromoSubmission): boolean {
  const t = decisionText(sub);
  if (!t) return false;
  return NEGATIVE_WORDS.some(w => t.includes(w));
}

function filterByTab(subs: PromoSubmission[], tab: ViewTab): PromoSubmission[] {
  switch (tab) {
    case 'articles':  return subs.filter(isArticle);
    case 'playlists': return subs.filter(isPlaylistSub);
    case 'positifs':  return subs.filter(isPositive);
    case 'negatifs':  return subs.filter(isNegative);
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DecisionBadge({ decision, action }: { decision: string | null; action: string | null }) {
  const text = decision || action;
  if (!text) return null;
  const lower = text.toLowerCase();
  let cls = 'bg-default-100 text-default-500';
  if (POSITIVE_WORDS.some(w => lower.includes(w)) && !NEGATIVE_WORDS.some(w => lower.includes(w))) {
    cls = 'bg-emerald-500/15 text-emerald-500';
  } else if (NEGATIVE_WORDS.some(w => lower.includes(w))) {
    cls = 'bg-danger/10 text-danger';
  } else if (lower.includes('listen')) {
    cls = 'bg-primary/10 text-primary';
  } else if (lower.includes('share') || lower.includes('feature')) {
    cls = 'bg-amber-500/10 text-amber-500';
  }
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${cls}`}>
      {text}
    </span>
  );
}

function SourceChip({ source }: { source: string | null }) {
  if (!source) return null;
  const lower = source.toLowerCase();
  const cls = lower === 'groover'
    ? 'bg-orange-500/10 text-orange-500'
    : lower === 'submithub'
    ? 'bg-blue-500/10 text-blue-500'
    : 'bg-default-100 text-default-500';
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-medium ${cls}`}>{source}</span>;
}

// Standard card for a single submission
function SubmissionCard({ sub, expanded, onToggle }: {
  sub: PromoSubmission;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasFeedback = !!sub.feedback;
  return (
    <div className="bg-content1 border border-divider rounded-2xl overflow-hidden">
      <button className="w-full text-left p-3" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{sub.song_title}</p>
            {sub.release_title && (
              <p className="text-[11px] text-default-400 truncate">{sub.release_title}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DecisionBadge decision={sub.decision} action={sub.action} />
            {hasFeedback && (
              <svg className={`w-3.5 h-3.5 text-default-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {(sub.outlet_name || sub.influencer_name) && (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[11px] text-default-500 truncate max-w-[120px]">
                {sub.outlet_name || sub.influencer_name}
              </span>
            </div>
          )}
          {(sub.outlet_type || sub.influencer_type) && (
            <span className="text-[10px] bg-default-100 text-default-500 px-1.5 py-0.5 rounded-lg">
              {sub.outlet_type || sub.influencer_type}
            </span>
          )}
          <SourceChip source={sub.source} />
          {sub.listen_time && (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] text-default-400">{formatListenTime(sub.listen_time)}</span>
            </div>
          )}
          <span className="text-[10px] text-default-300 ml-auto">
            {formatDate(sub.responded_at || sub.submitted_at)}
          </span>
        </div>
      </button>
      {expanded && hasFeedback && (
        <div className="px-3 pb-3 border-t border-divider pt-2.5">
          <p className="text-[11px] text-default-400 uppercase tracking-wider mb-1.5 font-semibold">Feedback</p>
          <p className="text-xs text-default-600 leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
          {sub.sharing_link && (
            <a href={sub.sharing_link} target="_blank" rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-[11px] text-primary font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Voir sur la plateforme
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Playlist view: grouped by track, then each curator/decision row
function PlaylistTrackGroup({ track, subs, onFilterTrack }: {
  track: string;
  subs: PromoSubmission[];
  onFilterTrack: (t: string) => void;
}) {
  const positive = subs.filter(isPositive).length;
  const negative = subs.filter(isNegative).length;
  return (
    <div className="bg-content1 border border-divider rounded-2xl overflow-hidden">
      <button
        className="w-full text-left px-3 py-2.5 flex items-center justify-between"
        onClick={() => onFilterTrack(track)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{track}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {positive > 0 && (
                <span className="text-[10px] text-emerald-500 font-medium">{positive} ✓</span>
              )}
              {negative > 0 && (
                <span className="text-[10px] text-danger font-medium">{negative} ✗</span>
              )}
              <span className="text-[10px] text-default-400">{subs.length} envoi{subs.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <svg className="w-4 h-4 text-default-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className="border-t border-divider divide-y divide-divider/50">
        {subs.map(sub => (
          <div key={sub.id} className="px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">
                {sub.outlet_name || sub.influencer_name || sub.outlet_type || sub.influencer_type || '—'}
              </p>
              {(sub.outlet_type || sub.influencer_type) && (
                <p className="text-[10px] text-default-400 truncate">{sub.outlet_type || sub.influencer_type}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <SourceChip source={sub.source} />
              <DecisionBadge decision={sub.decision} action={sub.action} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PromoPage() {
  const { artist, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>('playlists');
  const [trackFilter, setTrackFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (artist) load();
  }, [artist]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArtistPromoSubmissions({ limit: 500 });
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Count per tab
  const tabCounts = useMemo(() => ({
    articles:  filterByTab(submissions, 'articles').length,
    playlists: filterByTab(submissions, 'playlists').length,
    positifs:  filterByTab(submissions, 'positifs').length,
    negatifs:  filterByTab(submissions, 'negatifs').length,
  }), [submissions]);

  // Tab-filtered submissions
  const tabFiltered = useMemo(() => filterByTab(submissions, viewTab), [submissions, viewTab]);

  // After track filter
  const filtered = useMemo(() =>
    trackFilter ? tabFiltered.filter(s => s.song_title === trackFilter) : tabFiltered,
    [tabFiltered, trackFilter]
  );

  // Unique tracks in current tab
  const uniqueTracks = useMemo(() =>
    Array.from(new Set(tabFiltered.map(s => s.song_title))).sort(),
    [tabFiltered]
  );

  // For playlist tab: group by track
  const playlistsByTrack = useMemo(() => {
    if (viewTab !== 'playlists') return [];
    const map = new Map<string, PromoSubmission[]>();
    tabFiltered.forEach(s => {
      if (!map.has(s.song_title)) map.set(s.song_title, []);
      map.get(s.song_title)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [viewTab, tabFiltered]);

  const handleTabChange = (tab: ViewTab) => {
    setViewTab(tab);
    setTrackFilter(null);
    setExpandedId(null);
  };

  const handleFilterTrack = (track: string) => {
    setTrackFilter(track);
    setExpandedId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">

        {(authLoading || loading) && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {!authLoading && !loading && error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {!authLoading && !loading && (
          <>
            {/* ── Tab bar ── */}
            <div className="flex gap-1 bg-content1 border border-divider rounded-xl p-1 overflow-x-auto no-scrollbar">
              {TAB_CONFIG.map(({ key, label }) => {
                const count = tabCounts[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleTabChange(key)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      viewTab === key ? 'bg-primary text-white' : 'text-default-500 hover:text-foreground'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        viewTab === key ? 'bg-white/20 text-white' : 'bg-default-200 text-default-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Track filter chips (secondary) ── */}
            {uniqueTracks.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setTrackFilter(null)}
                  className={`flex-shrink-0 px-3 py-1 rounded-xl text-[11px] font-medium transition-colors ${
                    !trackFilter ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-content1 border border-divider text-default-500'
                  }`}
                >
                  Tous
                </button>
                {uniqueTracks.map(track => {
                  const cnt = tabFiltered.filter(s => s.song_title === track).length;
                  return (
                    <button
                      key={track}
                      onClick={() => setTrackFilter(trackFilter === track ? null : track)}
                      className={`flex-shrink-0 px-3 py-1 rounded-xl text-[11px] font-medium transition-colors ${
                        trackFilter === track
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-content1 border border-divider text-default-500'
                      }`}
                    >
                      {track} <span className="opacity-60">({cnt})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Content ── */}
            {tabFiltered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
                <p className="text-default-500 text-sm">
                  {TAB_CONFIG.find(t => t.key === viewTab)?.emptyLabel}
                </p>
                <p className="text-default-400 text-xs mt-1">Les résultats apparaîtront ici</p>
              </div>

            ) : viewTab === 'playlists' && !trackFilter ? (
              /* ── Playlists: grouped by track ── */
              <div className="space-y-3">
                <p className="text-[10px] text-default-400 px-1">
                  {playlistsByTrack.length} morceau{playlistsByTrack.length > 1 ? 'x' : ''} · {tabFiltered.length} curator{tabFiltered.length > 1 ? 's' : ''}
                </p>
                {playlistsByTrack.map(([track, subs]) => (
                  <PlaylistTrackGroup
                    key={track}
                    track={track}
                    subs={subs}
                    onFilterTrack={handleFilterTrack}
                  />
                ))}
              </div>

            ) : (
              /* ── Standard card list ── */
              <div className="space-y-2">
                <p className="text-[10px] text-default-400 px-1">
                  {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                  {trackFilter && (
                    <>
                      {' '}· <span className="font-medium text-primary">{trackFilter}</span>{' '}
                      <button onClick={() => setTrackFilter(null)} className="underline">effacer</button>
                    </>
                  )}
                </p>
                {filtered.map(sub => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    expanded={expandedId === sub.id}
                    onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
