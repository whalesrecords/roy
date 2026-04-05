'use client';

import { Card, CardBody, CardHeader } from '@heroui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

// Data extracted from Whales Records 2025-2026 report (updated April 2026)

const summary = [
  { label: 'Total Streams', value: '45.2M', sub: 'Tunecore · Jan 2025 – Avr 2026', color: 'text-primary' },
  { label: 'Revenus cumulés', value: '90 000 €', sub: 'Tunecore', color: 'text-success' },
  { label: 'Auditeurs/semaine', value: '14 760', sub: 'Tunecore', color: 'text-secondary' },
  { label: 'Pays actifs', value: '109', sub: 'Tunecore', color: 'text-warning' },
  { label: 'Artistes actifs', value: '28', sub: 'Spotify', color: 'text-danger' },
  { label: 'Total Fans', value: '359 000', sub: 'Soundchart · toutes plateformes', color: 'text-primary' },
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
    <>
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Streaming & Social</h1>
              <p className="text-secondary-500 text-sm mt-0.5">Données 2025–2026 · Mise à jour : Avril 2026</p>
            </div>
            <a
              href="/analytics"
              className="text-sm text-primary hover:underline"
            >
              ← Analytics financier
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {summary.map((s) => (
            <Card key={s.label} className="border border-divider rounded-2xl shadow-sm">
              <CardBody className="p-4">
                <p className="text-xs text-default-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-default-400 mt-1">{s.sub}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Top Tracks Tunecore */}
        <Card className="border border-divider rounded-2xl shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-divider">
            <div>
              <h2 className="font-semibold text-foreground">Top Morceaux — Tunecore</h2>
              <p className="text-xs text-default-400 mt-0.5">Jan 2025 – Avr 2026</p>
            </div>
          </CardHeader>
          <CardBody className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topTracks} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-default-200" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-default-500 text-xs" />
                <YAxis type="category" dataKey="title" width={150} className="text-default-500 text-xs" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Bar dataKey="streams" name="Streams" fill="#0088FE" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Geographic Distribution */}
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <div>
                <h2 className="font-semibold text-foreground">Répartition Géographique</h2>
                <p className="text-xs text-default-400 mt-0.5">Tunecore · estimation streams</p>
              </div>
            </CardHeader>
            <CardBody className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={geoData} dataKey="pct" nameKey="country" cx="50%" cy="50%" outerRadius={90} labelLine={false}>
                    {geoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name, props) => [`${props.payload.pct}% · ${fmt(props.payload.streams)}`, props.payload.country]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Top Songs Soundchart */}
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <div>
                <h2 className="font-semibold text-foreground">Top Chansons — Soundchart</h2>
                <p className="text-xs text-default-400 mt-0.5">Streams Spotify cumulés</p>
              </div>
            </CardHeader>
            <CardBody className="p-4">
              <div className="space-y-3">
                {topSongs.map((s, i) => (
                  <div key={s.title} className="flex items-center gap-3">
                    <span className="text-xs text-default-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <div className="mt-1 h-1.5 bg-default-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(s.streams / topSongs[0].streams) * 100}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-default-500 tabular-nums">{fmt(s.streams)}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Playlists */}
        <Card className="border border-divider rounded-2xl shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-divider">
            <div>
              <h2 className="font-semibold text-foreground">Présence en Playlists</h2>
              <p className="text-xs text-default-400 mt-0.5">Soundchart</p>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-divider">
              {playlists.map((p) => (
                <div key={p.platform} className="flex items-center justify-between px-4 py-3">
                  <p className="font-medium text-foreground">{p.platform}</p>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-foreground">{fmt(p.total)}</p>
                      <p className="text-xs text-default-400">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-primary">{p.editorial}</p>
                      <p className="text-xs text-default-400">Éditoriales</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Social Media */}
        <Card className="border border-divider rounded-2xl shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-divider">
            <div>
              <h2 className="font-semibold text-foreground">Réseaux Sociaux</h2>
              <p className="text-xs text-default-400 mt-0.5">Meta · 8 mars – 4 avril 2026</p>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-divider">
              {socialData.map((s) => (
                <div key={s.platform} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-foreground">{s.platform}</p>
                    <span className="text-xs text-success bg-success-50 px-2 py-0.5 rounded-full">{s.variation} followers</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-default-400 text-xs mb-0.5">Followers</p>
                      <p className="font-semibold text-foreground">{fmt(s.followers)}</p>
                    </div>
                    <div>
                      <p className="text-default-400 text-xs mb-0.5">Couverture (28j)</p>
                      <p className="font-semibold text-foreground">{fmt(s.reach28d)}</p>
                    </div>
                    <div>
                      <p className="text-default-400 text-xs mb-0.5">Interactions</p>
                      <p className="font-semibold text-foreground">{fmt(s.interactions)}</p>
                    </div>
                    <div>
                      <p className="text-default-400 text-xs mb-0.5">Nouveaux</p>
                      <p className="font-semibold text-success">+{s.newFollowers}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-default-400 pb-4">
          Sources : Tunecore, Spotify for Artists, Soundchart, Meta Business Suite · Rapport Whales Records 2025–2026
        </p>
      </div>
    </>
  );
}
