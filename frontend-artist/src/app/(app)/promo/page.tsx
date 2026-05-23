'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';

type SourceFilter = 'all' | 'groover' | 'submithub' | 'manual';

function formatDate(str: string | null): string {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatListenTime(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m${rem.toString().padStart(2, '0')}s` : `${s}s`;
}

function isPositive(sub: PromoSubmission): boolean {
  const text = ((sub.decision || '') + ' ' + (sub.action || '')).toLowerCase();
  if (!text.trim()) return false;
  const negative = ['pass', 'declined', 'rejected', 'not added', 'no thanks', 'sorry'];
  return !negative.some(n => text.includes(n));
}

function DecisionBadge({ decision, action }: { decision: string | null; action: string | null }) {
  const text = decision || action;
  if (!text) return null;

  const lower = text.toLowerCase();
  let cls = 'bg-default-100 text-default-500';
  if (lower.includes('playlist') || lower.includes('added') || lower.includes('approved') || lower.includes('accepted')) {
    cls = 'bg-emerald-500/15 text-emerald-500';
  } else if (lower.includes('pass') || lower.includes('declined') || lower.includes('rejected') || lower.includes('not')) {
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

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-content1 border border-divider rounded-2xl p-3 flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-default-500 uppercase tracking-wider text-center leading-tight">{label}</p>
    </div>
  );
}

export default function PromoPage() {
  const { artist, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [trackFilter, setTrackFilter] = useState<string | null>(null);
  const [releaseFilter, setReleaseFilter] = useState<string | null>(null);
  const [filterDim, setFilterDim] = useState<'source' | 'track' | 'release'>('source');
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

  // Stats computed from actual data (no reliance on buggy stats API)
  const stats = useMemo(() => ({
    total: submissions.length,
    withFeedback: submissions.filter(s => !!s.feedback).length,
    positive: submissions.filter(isPositive).length,
    playlists: submissions.filter(s => s.decision?.toLowerCase().includes('playlist') || s.decision?.toLowerCase().includes('added')).length,
  }), [submissions]);

  // Unique tracks and releases for filters
  const uniqueTracks = useMemo(() =>
    [...new Set(submissions.map(s => s.song_title))].sort(),
    [submissions]
  );
  const uniqueReleases = useMemo(() =>
    [...new Set(submissions.filter(s => s.release_title).map(s => s.release_title!))].sort(),
    [submissions]
  );

  // Source counts
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: submissions.length };
    submissions.forEach(s => {
      const k = s.source?.toLowerCase() || 'manual';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [submissions]);

  // Filtered submissions
  const filtered = useMemo(() => {
    let result = submissions;
    if (sourceFilter !== 'all') result = result.filter(s => s.source?.toLowerCase() === sourceFilter);
    if (trackFilter) result = result.filter(s => s.song_title === trackFilter);
    if (releaseFilter) result = result.filter(s => s.release_title === releaseFilter);
    return result;
  }, [submissions, sourceFilter, trackFilter, releaseFilter]);

  const clearSecondaryFilter = () => {
    setTrackFilter(null);
    setReleaseFilter(null);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Stats cards — computed from real data */}
        {submissions.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <StatCard
              label="Envois"
              value={stats.total}
              icon="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              color="bg-primary/10 text-primary"
            />
            <StatCard
              label="Feedback"
              value={stats.withFeedback}
              icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              color="bg-cyan-500/10 text-cyan-500"
            />
            <StatCard
              label="Positif"
              value={stats.positive}
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              color="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              label="Playlists"
              value={stats.playlists}
              icon="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
              color="bg-amber-500/10 text-amber-500"
            />
          </div>
        )}

        {/* Filter dimension tabs */}
        {submissions.length > 0 && (
          <div className="space-y-2">
            {/* Tab selector */}
            <div className="flex gap-1 bg-content1 border border-divider rounded-xl p-1">
              {(['source', 'track', 'release'] as const).map(dim => (
                <button
                  key={dim}
                  onClick={() => { setFilterDim(dim); clearSecondaryFilter(); if (dim !== 'source') setSourceFilter('all'); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterDim === dim ? 'bg-primary text-white' : 'text-default-500'
                  }`}
                >
                  {dim === 'source' ? 'Source' : dim === 'track' ? 'Track' : 'Campagne'}
                </button>
              ))}
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {filterDim === 'source' && (
                <>
                  {(['all', 'groover', 'submithub', 'manual'] as SourceFilter[]).map(src => {
                    const count = sourceCounts[src === 'all' ? 'all' : src] || 0;
                    if (src !== 'all' && !count) return null;
                    return (
                      <button
                        key={src}
                        onClick={() => setSourceFilter(src)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          sourceFilter === src
                            ? 'bg-primary text-white'
                            : 'bg-content1 border border-divider text-default-500'
                        }`}
                      >
                        {src === 'all' ? `Tout (${count})` : `${src.charAt(0).toUpperCase() + src.slice(1)} (${count})`}
                      </button>
                    );
                  })}
                </>
              )}

              {filterDim === 'track' && (
                <>
                  <button
                    onClick={() => setTrackFilter(null)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      !trackFilter ? 'bg-primary text-white' : 'bg-content1 border border-divider text-default-500'
                    }`}
                  >
                    Tout ({submissions.length})
                  </button>
                  {uniqueTracks.map(track => {
                    const count = submissions.filter(s => s.song_title === track).length;
                    return (
                      <button
                        key={track}
                        onClick={() => setTrackFilter(trackFilter === track ? null : track)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          trackFilter === track
                            ? 'bg-primary text-white'
                            : 'bg-content1 border border-divider text-default-500'
                        }`}
                      >
                        {track} ({count})
                      </button>
                    );
                  })}
                </>
              )}

              {filterDim === 'release' && (
                <>
                  <button
                    onClick={() => setReleaseFilter(null)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      !releaseFilter ? 'bg-primary text-white' : 'bg-content1 border border-divider text-default-500'
                    }`}
                  >
                    Tout ({submissions.length})
                  </button>
                  {uniqueReleases.map(release => {
                    const count = submissions.filter(s => s.release_title === release).length;
                    return (
                      <button
                        key={release}
                        onClick={() => setReleaseFilter(releaseFilter === release ? null : release)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          releaseFilter === release
                            ? 'bg-primary text-white'
                            : 'bg-content1 border border-divider text-default-500'
                        }`}
                      >
                        {release} ({count})
                      </button>
                    );
                  })}
                  {uniqueReleases.length === 0 && (
                    <span className="text-xs text-default-400 px-2 py-1.5">Aucune release liée</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-default-500 text-sm">Aucune campagne promo</p>
            <p className="text-default-400 text-xs mt-1">Les résultats Groover et SubmitHub apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-default-400 px-1">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</p>
            {filtered.map(sub => {
              const isExpanded = expandedId === sub.id;
              const hasFeedback = !!sub.feedback;
              return (
                <div
                  key={sub.id}
                  className="bg-content1 border border-divider rounded-2xl overflow-hidden"
                >
                  <button
                    className="w-full text-left p-3"
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
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
                          <svg className={`w-3.5 h-3.5 text-default-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      {sub.source && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-medium ${
                          sub.source.toLowerCase() === 'groover'
                            ? 'bg-orange-500/10 text-orange-500'
                            : sub.source.toLowerCase() === 'submithub'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-default-100 text-default-500'
                        }`}>
                          {sub.source}
                        </span>
                      )}
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

                  {/* Expanded feedback */}
                  {isExpanded && hasFeedback && (
                    <div className="px-3 pb-3 border-t border-divider pt-2.5">
                      <p className="text-[11px] text-default-400 uppercase tracking-wider mb-1.5 font-semibold">Feedback</p>
                      <p className="text-xs text-default-600 leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
                      {sub.sharing_link && (
                        <a
                          href={sub.sharing_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-[11px] text-primary font-medium"
                        >
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
            })}
          </div>
        )}
      </main>
    </div>
  );
}
