'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistPromoStats, getArtistPromoSubmissions, PromoStats, PromoSubmission } from '@/lib/api';

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
  const [stats, setStats] = useState<PromoStats | null>(null);
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (artist) load();
  }, [artist]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, subsData] = await Promise.all([
        getArtistPromoStats(),
        getArtistPromoSubmissions({ limit: 500 }),
      ]);
      setStats(statsData);
      setSubmissions(subsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (sourceFilter === 'all') return submissions;
    return submissions.filter(s => s.source?.toLowerCase() === sourceFilter);
  }, [submissions, sourceFilter]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: submissions.length };
    submissions.forEach(s => {
      const k = s.source?.toLowerCase() || 'manual';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [submissions]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-xl hover:bg-content1 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-foreground text-sm">Campagnes Promo</h1>
            <p className="text-[10px] text-default-400">Groover · SubmitHub · Résultats</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            <StatCard
              label="Envois"
              value={stats.total_submissions}
              icon="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              color="bg-primary/10 text-primary"
            />
            <StatCard
              label="Écoutes"
              value={stats.total_listens}
              icon="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              color="bg-cyan-500/10 text-cyan-500"
            />
            <StatCard
              label="Validés"
              value={stats.total_approvals}
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              color="bg-emerald-500/10 text-emerald-500"
            />
            <StatCard
              label="Playlists"
              value={stats.total_playlists}
              icon="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
              color="bg-amber-500/10 text-amber-500"
            />
          </div>
        )}

        {/* Source filter */}
        {submissions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
                        {/* Song + release */}
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

                    {/* Row 2: outlet + source + date */}
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
