'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { getDetailedPromoStats, getSpotifyAdCampaigns, DetailedPromoStats, SpotifyAdCampaign } from '@/lib/api';
import Link from 'next/link';
import { Card, Eyebrow, Kpi, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconImport, IconContract } from '@/components/roy/icons';

const PIE_COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#00C7F2', '#8b5cf6', '#f97316', '#ec4899'];

const formatNumber = (n: number) => n.toLocaleString('fr-FR');
const num = (v?: string | number | null) => (v == null ? 0 : Number(v) || 0);

export default function PromoStatsPage() {
  const [stats, setStats] = useState<DetailedPromoStats | null>(null);
  const [campaigns, setCampaigns] = useState<SpotifyAdCampaign[]>([]);
  const [adCurrency, setAdCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [data, ads] = await Promise.all([
        getDetailedPromoStats(),
        getSpotifyAdCampaigns().catch(() => null),
      ]);
      setStats(data);
      if (ads) {
        setCampaigns(ads.campaigns);
        setAdCurrency(ads.currency || 'EUR');
      }
    } catch (err: any) {
      console.error('Error loading promo stats:', err);
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const fmtEUR = (v: number) =>
    v.toLocaleString('fr-FR', { style: 'currency', currency: adCurrency, maximumFractionDigits: 0 });

  // ── Spotify Ads aggregates (paid promo) ──
  const ads = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + num(c.spend), 0);
    const reach = campaigns.reduce((s, c) => s + num(c.reach), 0);
    const newListeners = campaigns.reduce((s, c) => s + num(c.new_active_listeners), 0);
    const converted = campaigns.reduce((s, c) => s + num(c.converted_listeners), 0);
    const playlistAdds = campaigns.reduce((s, c) => s + num(c.playlist_adds), 0);
    const saves = campaigns.reduce((s, c) => s + num(c.saves), 0);
    const spendByArtist = new Map<string, number>();
    campaigns.forEach((c) => {
      const key = (c.artist_name || '').toLowerCase().trim();
      if (key) spendByArtist.set(key, (spendByArtist.get(key) || 0) + num(c.spend));
    });
    return { totalSpend, reach, newListeners, converted, playlistAdds, saves, count: campaigns.length, spendByArtist };
  }, [campaigns]);

  const sourceData = useMemo(
    () =>
      stats
        ? Object.entries(stats.by_source).map(([source, count]) => ({ name: source, value: count }))
        : [],
    [stats],
  );

  const actionData = useMemo(
    () =>
      stats
        ? Object.entries(stats.by_action).map(([action, count]) => ({ name: action, value: count }))
        : [],
    [stats],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const approvalRate =
    stats && stats.total_submissions > 0
      ? ((stats.total_approvals / stats.total_submissions) * 100).toFixed(1)
      : '0';

  const rateTone = (rate: number) =>
    rate >= 30 ? 'text-accent' : rate >= 15 ? 'text-ink' : 'text-ink-faint';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Stats Promo</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Récapitulatif de vos campagnes promo</p>
        </div>
        <Link href="/promo/import">
          <AccentButton>
            <IconImport size={14} /> Importer CSV
          </AccentButton>
        </Link>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {!stats ? (
          <Card className="py-12 text-center">
            <p className="text-ink-faint text-[13px]">No stats available</p>
          </Card>
        ) : (
          <>
            {/* KPI cards — promo organique (SubmitHub / Groover) */}
            <div>
              <Eyebrow className="mb-2.5 block">Promo curateurs (SubmitHub / Groover)</Eyebrow>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <Kpi label="Total Submissions" value={formatNumber(stats.total_submissions)} />
                <Kpi
                  label="Approvals"
                  value={formatNumber(stats.total_approvals)}
                  hero
                  accentValue
                  hint={`${approvalRate}% approval rate`}
                  hintTone="accent"
                />
                <Kpi label="Playlist Adds" value={formatNumber(stats.total_playlists)} accentValue />
                <Kpi label="Listens" value={formatNumber(stats.total_listens)} />
              </div>
            </div>

            {/* KPI cards — publicité payante (Spotify Ads) */}
            {campaigns.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <Eyebrow className="block">Publicité payante (Spotify Ads)</Eyebrow>
                  <span className="text-[11.5px] text-ink-faint">{ads.count} campagne{ads.count > 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <Kpi label="Dépense pub" value={fmtEUR(ads.totalSpend)} hero accentValue />
                  <Kpi label="Portée" value={formatNumber(ads.reach)} />
                  <Kpi label="Nouveaux auditeurs" value={formatNumber(ads.newListeners)} />
                  <Kpi label="Auditeurs convertis" value={formatNumber(ads.converted)} accentValue />
                  <Kpi label="Ajouts playlist (pub)" value={formatNumber(ads.playlistAdds)} accentValue />
                  <Kpi label="Enregistrements" value={formatNumber(ads.saves)} />
                  <Kpi
                    label="Playlists totales"
                    value={formatNumber(stats.total_playlists + ads.playlistAdds)}
                    hint="curateurs + pub"
                  />
                  <Kpi
                    label="Coût / conversion"
                    value={ads.converted > 0 ? fmtEUR(ads.totalSpend / ads.converted) : '—'}
                  />
                </div>
              </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <Card>
                <span className="text-[13.5px] font-semibold text-ink">Par Source</span>
                {sourceData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" labelLine={false} outerRadius={78} dataKey="value">
                          {sourceData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatNumber(value as number)}
                          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2.5">
                      {sourceData.map((source, idx) => (
                        <div key={source.name} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[13px] text-ink capitalize">
                            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            {source.name}
                          </span>
                          <span className="roy-num text-[13px] font-semibold text-ink">{formatNumber(source.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-60 flex items-center justify-center text-ink-faint text-[13px]">Aucune donnée</div>
                )}
              </Card>

              <Card>
                <span className="text-[13.5px] font-semibold text-ink">Par Action (SubmitHub)</span>
                {actionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={actionData} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(value) => formatNumber(value as number)}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                        cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                      />
                      <Bar dataKey="value" name="Actions" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-ink-faint text-[13px]">No SubmitHub data</div>
                )}
              </Card>
            </div>

            {/* Stats by Artist */}
            {stats.by_artist && stats.by_artist.length > 0 && (
              <Card padded={false} className="overflow-hidden">
                <div className="px-[22px] py-4 border-b border-line">
                  <span className="text-[13.5px] font-semibold text-ink">Stats par Artiste</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="py-3 px-[22px]"><Eyebrow>Artiste</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Submissions</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Écoutés</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Approuvés</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Playlists</Eyebrow></th>
                        {campaigns.length > 0 && <th className="py-3 px-3 text-right"><Eyebrow>Pub Spotify</Eyebrow></th>}
                        <th className="py-3 px-[22px] text-right"><Eyebrow>Taux</Eyebrow></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_artist.map((artist) => {
                        const adSpend = ads.spendByArtist.get((artist.artist_name || '').toLowerCase().trim()) || 0;
                        return (
                        <tr key={artist.artist_id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                          <td className="py-3 px-[22px] text-[13px] font-semibold text-ink">{artist.artist_name}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] text-ink">{artist.total_submissions}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] text-ink-muted">{artist.total_listened}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] font-semibold text-accent">{artist.total_approved}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] font-semibold text-ink">{artist.total_playlists}</td>
                          {campaigns.length > 0 && (
                            <td className="py-3 px-3 text-right roy-num text-[13px] text-ink-muted">{adSpend > 0 ? fmtEUR(adSpend) : '—'}</td>
                          )}
                          <td className={`py-3 px-[22px] text-right roy-num text-[13px] font-semibold ${rateTone(artist.approval_rate)}`}>
                            {artist.approval_rate}%
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Stats by Album */}
            {stats.by_album && stats.by_album.length > 0 && (
              <Card padded={false} className="overflow-hidden">
                <div className="px-[22px] py-4 border-b border-line">
                  <span className="text-[13.5px] font-semibold text-ink">Stats par Album</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="py-3 px-[22px]"><Eyebrow>Album</Eyebrow></th>
                        <th className="py-3 px-3"><Eyebrow>Artiste</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Submissions</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Écoutés</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Approuvés</Eyebrow></th>
                        <th className="py-3 px-3 text-right"><Eyebrow>Playlists</Eyebrow></th>
                        <th className="py-3 px-[22px] text-right"><Eyebrow>Taux</Eyebrow></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.by_album.map((album, idx) => (
                        <tr key={album.release_upc || idx} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                          <td className="py-3 px-[22px] text-[13px] font-semibold text-ink">{album.release_title}</td>
                          <td className="py-3 px-3 text-[13px] text-ink-faint">{album.artist_name}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] text-ink">{album.total_submissions}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] text-ink-muted">{album.total_listened}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] font-semibold text-accent">{album.total_approved}</td>
                          <td className="py-3 px-3 text-right roy-num text-[13px] font-semibold text-ink">{album.total_playlists}</td>
                          <td className={`py-3 px-[22px] text-right roy-num text-[13px] font-semibold ${rateTone(album.approval_rate)}`}>
                            {album.approval_rate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Quick actions */}
            <div className="flex gap-3">
              <Link href="/promo/submissions">
                <OutlineButton>
                  <IconContract size={14} /> Voir toutes les submissions
                </OutlineButton>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
