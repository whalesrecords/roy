'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, getArtistAdCampaigns, PromoSubmission, ArtistAdCampaign } from '@/lib/api';
import { Card, Eyebrow, Pill, Segmented, fmtMoney, fmtNum } from '@/components/roy/ui';
import { IconMegaphone, IconChevronRight, IconUser } from '@/components/roy/icons';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewTab = 'playlists' | 'articles' | 'positifs';

const TAB_CONFIG: Array<{ key: ViewTab; label: string; emptyLabel: string }> = [
  { key: 'playlists', label: 'Playlists',          emptyLabel: 'Aucune playlist' },
  { key: 'articles',  label: 'Articles & médias',  emptyLabel: 'Aucun article / blog' },
  { key: 'positifs',  label: 'Retours positifs',   emptyLabel: 'Aucun retour positif' },
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

function filterByTab(subs: PromoSubmission[], tab: ViewTab): PromoSubmission[] {
  switch (tab) {
    case 'articles':  return subs.filter(isArticle);
    case 'playlists': return subs.filter(isPlaylistSub);
    case 'positifs':  return subs.filter(isPositive);
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DecisionBadge({ decision, action }: { decision: string | null; action: string | null }) {
  const text = decision || action;
  if (!text) return null;
  const lower = text.toLowerCase();
  const positive = POSITIVE_WORDS.some(w => lower.includes(w)) && !NEGATIVE_WORDS.some(w => lower.includes(w));
  return <Pill tone={positive ? 'accent' : 'neutral'}>{text}</Pill>;
}

function SourceChip({ source }: { source: string | null }) {
  if (!source) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-lg font-medium bg-surface-2 text-ink-muted">{source}</span>
  );
}

// Standard card for a single submission
function SubmissionCard({ sub, expanded, onToggle }: {
  sub: PromoSubmission;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasFeedback = !!sub.feedback;
  return (
    <div className="bg-surface border border-line rounded-[18px] shadow-roy overflow-hidden">
      <button className="w-full text-left p-3.5" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">{sub.song_title}</p>
            {sub.release_title && (
              <p className="text-[11px] text-ink-faint truncate mt-0.5">{sub.release_title}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <DecisionBadge decision={sub.decision} action={sub.action} />
            {hasFeedback && (
              <IconChevronRight size={14} className={`text-ink-faint transition-transform ${expanded ? 'rotate-90' : ''}`} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {(sub.outlet_name || sub.influencer_name) && (
            <div className="flex items-center gap-1 text-ink-faint">
              <IconUser size={12} />
              <span className="text-[11px] text-ink-muted truncate max-w-[120px]">
                {sub.outlet_name || sub.influencer_name}
              </span>
            </div>
          )}
          {(sub.outlet_type || sub.influencer_type) && (
            <span className="text-[10px] bg-surface-2 text-ink-muted px-1.5 py-0.5 rounded-lg">
              {sub.outlet_type || sub.influencer_type}
            </span>
          )}
          <SourceChip source={sub.source} />
          {sub.listen_time && (
            <div className="flex items-center gap-1 text-ink-faint">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] text-ink-faint">{formatListenTime(sub.listen_time)}</span>
            </div>
          )}
          <span className="text-[10px] text-ink-faint ml-auto">
            {formatDate(sub.responded_at || sub.submitted_at)}
          </span>
        </div>
      </button>
      {expanded && hasFeedback && (
        <div className="px-3.5 pb-3.5 border-t border-line pt-3">
          <Eyebrow>Feedback</Eyebrow>
          <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap mt-1.5">{sub.feedback}</p>
          {sub.sharing_link && (
            <a href={sub.sharing_link} target="_blank" rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-accent font-semibold">
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
  return (
    <div className="bg-surface border border-line rounded-[18px] shadow-roy overflow-hidden">
      <button
        className="w-full text-left px-3.5 py-3 flex items-center justify-between"
        onClick={() => onFilterTrack(track)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[11px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">{track}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {positive > 0 && (
                <span className="text-[10px] text-accent font-semibold">{positive} ✓</span>
              )}
              <span className="text-[10px] text-ink-faint">{subs.length} envoi{subs.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <IconChevronRight size={16} className="text-ink-faint shrink-0" />
      </button>
      <div className="border-t border-line divide-y divide-line">
        {subs.map(sub => (
          <div key={sub.id} className="px-3.5 py-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink truncate">
                {sub.outlet_name || sub.influencer_name || sub.outlet_type || sub.influencer_type || '—'}
              </p>
              {(sub.outlet_type || sub.influencer_type) && (
                <p className="text-[10px] text-ink-faint truncate">{sub.outlet_type || sub.influencer_type}</p>
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
  const [adCampaigns, setAdCampaigns] = useState<ArtistAdCampaign[]>([]);
  const [adSpend, setAdSpend] = useState<string>('0');
  const [adCurrency, setAdCurrency] = useState<string>('EUR');
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
    // Spotify ad campaigns — non-blocking
    try {
      const ads = await getArtistAdCampaigns();
      setAdCampaigns(ads.campaigns);
      setAdSpend(ads.total_spend);
      setAdCurrency(ads.currency || 'EUR');
    } catch { /* ignore */ }
  };

  // Count per tab
  const tabCounts = useMemo(() => ({
    articles:  filterByTab(submissions, 'articles').length,
    playlists: filterByTab(submissions, 'playlists').length,
    positifs:  filterByTab(submissions, 'positifs').length,
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

  const tabOptions = TAB_CONFIG.map(({ key, label }) => {
    const count = tabCounts[key];
    return { value: key, label: count > 0 ? `${label} (${count})` : label };
  });

  const totalSubs = submissions.length;
  const totalPositive = useMemo(() => submissions.filter(isPositive).length, [submissions]);
  const totalPlaylists = tabCounts.playlists;

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Promo</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Retours playlists, presse et curateurs</div>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">

        {(authLoading || loading) && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {!authLoading && !loading && error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>
        )}

        {!authLoading && !loading && !error && (
          <>
            {/* ── KPI cards ── */}
            <div className="grid grid-cols-3 gap-3 lg:gap-4">
              <Card>
                <Eyebrow className="text-[9.5px]">Soumissions</Eyebrow>
                <div className="roy-num text-[24px] lg:text-[30px] font-bold text-ink leading-none mt-2">{totalSubs}</div>
              </Card>
              <Card>
                <Eyebrow className="text-[9.5px]">Retours positifs</Eyebrow>
                <div className="roy-num text-[24px] lg:text-[30px] font-bold text-ink leading-none mt-2">{totalPositive}</div>
              </Card>
              <Card>
                <Eyebrow className="text-[9.5px]">Playlists</Eyebrow>
                <div className="roy-num text-[24px] lg:text-[30px] font-bold text-ink leading-none mt-2">{totalPlaylists}</div>
              </Card>
            </div>

            {/* ── Publicités Spotify (transparence dépense + résultats) ── */}
            {adCampaigns.length > 0 && (
              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-[9px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 11-.452-1.493c3.632-1.102 8.147-.568 11.234 1.33a.78.78 0 01.255 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.936.936 0 01-.958 1.607z"/></svg>
                    </span>
                    <span className="text-[14px] font-semibold text-ink">Publicités Spotify</span>
                  </div>
                  <div className="text-right">
                    <Eyebrow className="text-[9px]">Total dépensé</Eyebrow>
                    <div className="roy-num text-[15px] font-bold text-ink">{fmtMoney(adSpend, adCurrency)}</div>
                  </div>
                </div>
                <div className="divide-y divide-line">
                  {adCampaigns.map((c) => {
                    const metrics: { label: string; value: string }[] = [
                      { label: 'Portée', value: c.reach != null ? fmtNum(c.reach) : '—' },
                      { label: 'Clics', value: c.clicks != null ? fmtNum(c.clicks) : '—' },
                      { label: 'Nouveaux auditeurs', value: c.new_active_listeners != null ? fmtNum(c.new_active_listeners) : '—' },
                      { label: 'Conversions', value: c.converted_listeners != null ? fmtNum(c.converted_listeners) : '—' },
                      { label: 'Saves', value: c.saves != null ? fmtNum(c.saves) : '—' },
                      { label: 'Ajouts playlist', value: c.playlist_adds != null ? fmtNum(c.playlist_adds) : '—' },
                    ];
                    const period = [c.start_date, c.end_date]
                      .filter(Boolean)
                      .map((d) => new Date(d as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))
                      .join(' → ');
                    return (
                      <div key={c.id} className="px-[18px] py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold text-ink truncate">{c.release_name || c.campaign_name}</div>
                            <div className="text-[11.5px] text-ink-faint mt-0.5">{period}{c.conversion_rate ? ` · conv. ${c.conversion_rate}%` : ''}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="roy-num text-[15px] font-bold text-ink">{fmtMoney(c.spend ?? 0, c.currency)}</div>
                            <div className="text-[10px] text-ink-faint">dépensé</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {metrics.map((m) => (
                            <div key={m.label} className="rounded-[10px] bg-surface-2 px-2.5 py-2">
                              <div className="roy-num text-[13px] font-bold text-ink">{m.value}</div>
                              <div className="text-[9.5px] text-ink-faint leading-tight mt-0.5">{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* ── Tab bar ── */}
            <div className="overflow-x-auto no-scrollbar">
              <Segmented options={tabOptions} value={viewTab} onChange={handleTabChange} />
            </div>

            {/* ── Track filter chips (secondary) ── */}
            {uniqueTracks.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setTrackFilter(null)}
                  className={`flex-shrink-0 px-3 py-1 rounded-xl text-[11px] font-medium transition-colors ${
                    !trackFilter ? 'bg-accent-soft text-accent border border-accent/20' : 'bg-surface border border-line text-ink-muted'
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
                          ? 'bg-accent-soft text-accent border border-accent/20'
                          : 'bg-surface border border-line text-ink-muted'
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
                <div className="w-14 h-14 bg-surface border border-line rounded-[18px] flex items-center justify-center mx-auto mb-4 text-ink-faint">
                  <IconMegaphone size={24} />
                </div>
                <p className="text-ink-muted text-sm">
                  {TAB_CONFIG.find(t => t.key === viewTab)?.emptyLabel}
                </p>
                <p className="text-ink-faint text-xs mt-1">Les résultats apparaîtront ici</p>
              </div>

            ) : viewTab === 'playlists' && !trackFilter ? (
              /* ── Playlists: grouped by track ── */
              <div className="space-y-3">
                <p className="text-[10px] text-ink-faint px-1">
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
              <div className="space-y-2.5">
                <p className="text-[10px] text-ink-faint px-1">
                  {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                  {trackFilter && (
                    <>
                      {' '}· <span className="font-medium text-accent">{trackFilter}</span>{' '}
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
