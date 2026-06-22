'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getArtistReleases, getArtistTracks, getArtistDashboard,
  ArtistRelease, ArtistTrack, ArtistDashboard,
} from '@/lib/api';
import { Card, Eyebrow, Segmented, fmtMoney, fmtNum } from '@/components/roy/ui';
import { IconSearch, IconMusic } from '@/components/roy/icons';

const COVER = { background: 'var(--cover)' } as const;

export default function MusiquePage() {
  const { artist, loading: authLoading } = useAuth();
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [dashboard, setDashboard] = useState<ArtistDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'titres' | 'sorties'>('titres');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!artist) return;
    Promise.all([getArtistReleases(), getArtistTracks(), getArtistDashboard()])
      .then(([r, t, d]) => { setReleases(r); setTracks(t); setDashboard(d); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [artist]);

  const currency = dashboard?.currency || tracks[0]?.currency || 'EUR';
  const trackCount = dashboard?.track_count ?? tracks.length;
  const totalStreams = dashboard?.total_streams ?? tracks.reduce((s, t) => s + t.streams, 0);

  const q = search.toLowerCase();
  const filteredReleases = useMemo(
    () => [...releases].filter((r) => !q || r.title.toLowerCase().includes(q)).sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross)),
    [releases, q],
  );
  const filteredTracks = useMemo(
    () => [...tracks].filter((t) => !q || t.title.toLowerCase().includes(q)).sort((a, b) => b.streams - a.streams),
    [tracks, q],
  );

  const releaseMeta = (r: ArtistRelease) => `${r.track_count} titre${r.track_count > 1 ? 's' : ''} · ${fmtNum(r.streams)}`;

  const searchBox = (full = false) => (
    <div className={`flex items-center gap-2.5 rounded-[14px] bg-surface border border-line px-3.5 py-2.5 ${full ? '' : 'w-[260px]'}`}>
      <IconSearch size={16} className="text-ink-faint" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un titre…"
        className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Musique</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">{trackCount} titres · {fmtNum(totalStreams)} streams cumulés</div>
        </div>
        {searchBox()}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto">
        {error && <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm mb-3">{error}</div>}

        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
        ) : (<>
          {/* Mobile header */}
          <div className="lg:hidden">
            <Eyebrow>Catalogue</Eyebrow>
            <div className="flex items-baseline gap-2.5 mt-1.5">
              <div className="roy-num text-[44px] font-bold text-ink leading-none">{trackCount}</div>
              <div className="text-[14px] text-ink-muted">titres · {fmtNum(totalStreams)} streams</div>
            </div>
            <div className="mt-5">{searchBox(true)}</div>
            <div className="mt-3.5">
              <Segmented
                options={[{ value: 'titres', label: 'Titres' }, { value: 'sorties', label: 'Sorties' }]}
                value={tab}
                onChange={setTab}
              />
            </div>

            {/* Mobile list */}
            <div className="mt-4 flex flex-col">
              {tab === 'titres' ? (
                filteredTracks.length === 0 ? <p className="text-center py-10 text-ink-faint text-sm">Aucun titre</p> :
                filteredTracks.map((t, i) => (
                  <div key={t.isrc || t.title} className={`flex items-center gap-3.5 py-2.5 ${i < filteredTracks.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="w-[46px] h-[46px] rounded-[10px] shrink-0" style={COVER} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-ink truncate">{t.title}</div>
                      <div className="text-[11px] text-ink-faint mt-0.5 truncate">{(t.release_title || 'Single')} · {fmtNum(t.streams)}</div>
                    </div>
                    <span className="roy-num text-[13px] font-bold text-ink">{fmtMoney(t.gross, t.currency)}</span>
                  </div>
                ))
              ) : (
                filteredReleases.length === 0 ? <p className="text-center py-10 text-ink-faint text-sm">Aucune sortie</p> :
                filteredReleases.map((r, i) => (
                  <div key={r.upc} className={`flex items-center gap-3.5 py-2.5 ${i < filteredReleases.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="w-[46px] h-[46px] rounded-[10px] overflow-hidden shrink-0" style={COVER}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.artwork_url && <img src={r.artwork_url} alt={r.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-ink truncate">{r.title}</div>
                      <div className="text-[11px] text-ink-faint mt-0.5">{releaseMeta(r)}</div>
                    </div>
                    <span className="roy-num text-[13px] font-bold text-ink">{fmtMoney(r.gross, r.currency)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Desktop sections */}
          <div className="hidden lg:block">
            {/* Sorties grid */}
            <div className="text-[14px] font-semibold text-ink mb-3.5">Sorties</div>
            {filteredReleases.length === 0 ? (
              <p className="text-ink-faint text-sm">Aucune sortie</p>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {filteredReleases.slice(0, 8).map((r) => (
                  <div key={r.upc}>
                    <div className="aspect-square rounded-[14px] overflow-hidden" style={COVER}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.artwork_url && <img src={r.artwork_url} alt={r.title} className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-[13.5px] font-semibold text-ink mt-2.5 truncate">{r.title}</div>
                    <div className="text-[11.5px] text-ink-faint mt-0.5 truncate">{releaseMeta(r)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Titres table */}
            <div className="text-[14px] font-semibold text-ink mt-7 mb-3">Titres</div>
            <Card padded={false} className="overflow-hidden rounded-[18px]">
              <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr] px-6 py-3 border-b border-line roy-eyebrow text-[10px]">
                <span>Titre</span><span>Sortie</span><span className="text-right">Streams</span><span className="text-right">Revenus</span>
              </div>
              {filteredTracks.length === 0 ? (
                <div className="px-6 py-10 text-center text-ink-faint text-sm">Aucun titre</div>
              ) : filteredTracks.map((t) => (
                <div key={t.isrc || t.title} className="grid grid-cols-[2fr_1.2fr_1fr_1fr] items-center px-6 py-3 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                  <span className="flex items-center gap-3.5 min-w-0">
                    <span className="w-[38px] h-[38px] rounded-[9px] shrink-0" style={COVER} />
                    <span className="text-[13.5px] font-semibold text-ink truncate">{t.title}</span>
                  </span>
                  <span className="text-[12.5px] text-ink-muted truncate">{t.release_title || 'Single'}</span>
                  <span className="text-right roy-num text-[13px] text-ink-muted">{fmtNum(t.streams)}</span>
                  <span className="text-right roy-num text-[13px] font-bold text-ink">{fmtMoney(t.gross, t.currency)}</span>
                </div>
              ))}
            </Card>
          </div>
        </>)}
      </main>
    </div>
  );
}
