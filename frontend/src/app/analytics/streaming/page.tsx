'use client';

import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, Eyebrow, Pill } from '@/components/roy/ui';
import { IconChevronRight } from '@/components/roy/icons';

const COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#00C7F2', '#8b5cf6', '#f97316', '#ec4899'];

// Data extracted from Whales Records 2025-2026 report (updated April 2026)

const summary = [
  { label: 'Total Streams', value: '45.2M', sub: 'Tunecore · Jan 2025 – Avr 2026' },
  { label: 'Revenus cumulés', value: '90 000 €', sub: 'Tunecore' },
  { label: 'Auditeurs/semaine', value: '14 760', sub: 'Tunecore' },
  { label: 'Pays actifs', value: '109', sub: 'Tunecore' },
  { label: 'Artistes actifs', value: '28', sub: 'Spotify' },
  { label: 'Total Fans', value: '359 000', sub: 'Soundchart · toutes plateformes' },
];

const topTracks = [
  { title: 'Mountains of Love', streams: 355708 },
  { title: 'Movement VII', streams: 103989 },
  { title: 'Hockey sur glace', streams: 87346 },
  { title: 'On Liquid Stones', streams: 71153 },
  { title: 'Movement VI', streams: 60780 },
  { title: 'Mountains of Love (alt)', streams: 56050 },
  { title: 'If I Must', streams: 50445 },
  { title: 'Lunar Solitude', streams: 48660 },
  { title: 'Out on the ice', streams: 42131 },
  { title: 'Insight VIII', streams: 40590 },
];

const geoData = [
  { country: 'France', pct: 28.6, streams: 12927200 },
  { country: 'USA', pct: 23.8, streams: 10757600 },
  { country: 'Allemagne', pct: 8.5, streams: 3842000 },
  { country: 'Mexique', pct: 3.2, streams: 1446400 },
  { country: 'Brésil', pct: 2.9, streams: 1310800 },
  { country: 'Royaume-Uni', pct: 2.8, streams: 1265600 },
  { country: 'Turquie', pct: 2.5, streams: 1130000 },
  { country: 'Canada', pct: 2.2, streams: 994400 },
  { country: 'Italie', pct: 2.1, streams: 949200 },
  { country: 'Autres', pct: 21.4, streams: 9676800 },
];

const topSongs = [
  { title: 'Shootout', streams: 174560000 },
  { title: 'Shootout (Sped Up)', streams: 126530000 },
  { title: 'Shootout (Slowed + Reverb)', streams: 84250000 },
  { title: 'Doppelgänger', streams: 40210000 },
  { title: 'Your Name', streams: 29970000 },
  { title: 'Daylight (Alt)', streams: 12900000 },
  { title: 'Turanim', streams: 12300000 },
  { title: 'Limbo', streams: 10840000 },
];

const playlists = [
  { platform: 'Spotify', total: 4900, editorial: 2 },
  { platform: 'Apple Music', total: 425, editorial: 329 },
  { platform: 'Qobuz', total: 22, editorial: 18 },
  { platform: 'Amazon', total: 7, editorial: 7 },
  { platform: 'Deezer', total: 3, editorial: 2 },
];

const socialData = [
  { platform: 'Instagram', followers: 1500, reach28d: 3700, interactions: 732, newFollowers: 23, variation: '+35.3%' },
  { platform: 'Facebook', followers: 730, reach28d: 594, interactions: 30, newFollowers: 1, variation: '+100%' },
];

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function StreamingAnalyticsPage() {
  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Streaming &amp; Social</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Whales Records · données 2025–2026 · mise à jour avril 2026</p>
        </div>
        <Link href="/analytics"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-surface-2 transition-colors">
          <IconChevronRight size={14} className="rotate-180" /> Analytics financier
        </Link>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {summary.map((s) => (
            <Card key={s.label}>
              <Eyebrow>{s.label}</Eyebrow>
              <div className="roy-num text-[22px] font-bold mt-2 text-ink">{s.value}</div>
              <div className="text-[11px] text-ink-faint mt-1">{s.sub}</div>
            </Card>
          ))}
        </div>

        {/* Top Tracks Tunecore */}
        <Card>
          <div>
            <span className="text-[13.5px] font-semibold text-ink">Top morceaux — Tunecore</span>
            <p className="text-[11px] text-ink-faint mt-0.5">Jan 2025 – Avr 2026</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topTracks} layout="vertical" margin={{ top: 12, left: 10, right: 20 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="title" width={150} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => fmt(v as number)}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                cursor={{ fill: 'var(--surface-2)' }}
              />
              <Bar dataKey="streams" name="Streams" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Geographic Distribution */}
          <Card>
            <div>
              <span className="text-[13.5px] font-semibold text-ink">Répartition géographique</span>
              <p className="text-[11px] text-ink-faint mt-0.5">Tunecore · estimation streams</p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={geoData} dataKey="pct" nameKey="country" cx="50%" cy="50%" outerRadius={90} labelLine={false}>
                  {geoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: any, name: any, props: any) => [`${props.payload.pct}% · ${fmt(props.payload.streams)}`, props.payload.country]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-3)' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Top Songs Soundchart */}
          <Card>
            <div>
              <span className="text-[13.5px] font-semibold text-ink">Top chansons — Soundchart</span>
              <p className="text-[11px] text-ink-faint mt-0.5">Streams Spotify cumulés</p>
            </div>
            <div className="space-y-3 mt-3.5">
              {topSongs.map((s, i) => (
                <div key={s.title} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-faint w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{s.title}</p>
                    <div className="mt-1 h-1.5 bg-track rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.streams / topSongs[0].streams) * 100}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="roy-num text-[12px] text-ink-muted">{fmt(s.streams)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Playlists */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-[22px] py-4 border-b border-line">
            <span className="text-[13.5px] font-semibold text-ink">Présence en playlists</span>
            <p className="text-[11px] text-ink-faint mt-0.5">Soundchart</p>
          </div>
          <div>
            {playlists.map((p) => (
              <div key={p.platform} className="flex items-center justify-between px-[22px] py-3.5 border-b border-line last:border-0">
                <p className="text-[13px] font-semibold text-ink">{p.platform}</p>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="roy-num text-[14px] font-bold text-ink">{fmt(p.total)}</p>
                    <p className="text-[10px] text-ink-faint mt-0.5">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="roy-num text-[14px] font-bold text-accent">{p.editorial}</p>
                    <p className="text-[10px] text-ink-faint mt-0.5">Éditoriales</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Social Media */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-[22px] py-4 border-b border-line">
            <span className="text-[13.5px] font-semibold text-ink">Réseaux sociaux</span>
            <p className="text-[11px] text-ink-faint mt-0.5">Meta · 8 mars – 4 avril 2026</p>
          </div>
          <div>
            {socialData.map((s) => (
              <div key={s.platform} className="px-[22px] py-4 border-b border-line last:border-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13.5px] font-semibold text-ink">{s.platform}</p>
                  <Pill tone="accent">{s.variation} followers</Pill>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Eyebrow>Followers</Eyebrow>
                    <p className="roy-num text-[14px] font-bold text-ink mt-1">{fmt(s.followers)}</p>
                  </div>
                  <div>
                    <Eyebrow>Couverture (28j)</Eyebrow>
                    <p className="roy-num text-[14px] font-bold text-ink mt-1">{fmt(s.reach28d)}</p>
                  </div>
                  <div>
                    <Eyebrow>Interactions</Eyebrow>
                    <p className="roy-num text-[14px] font-bold text-ink mt-1">{fmt(s.interactions)}</p>
                  </div>
                  <div>
                    <Eyebrow>Nouveaux</Eyebrow>
                    <p className="roy-num text-[14px] font-bold text-accent mt-1">+{s.newFollowers}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-[11px] text-ink-faint pb-4">
          Sources : Tunecore, Spotify for Artists, Soundchart, Meta Business Suite · Rapport Whales Records 2025–2026
        </p>
      </div>
    </div>
  );
}
