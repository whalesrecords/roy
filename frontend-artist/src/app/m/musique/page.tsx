'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getArtistReleases, getArtistTracks, ArtistRelease, ArtistTrack } from '@/lib/api';
import { ArtistBottomNav } from '@/components/roy/ArtistBottomNav';
import { Sheet } from '@/components/roy/Sheet';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const fmtMillions = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' K';
  return n.toString();
};

type Tab = 'tracks' | 'releases';

export default function MobileMusiquePage() {
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('tracks');
  const [selectedTrack, setSelectedTrack] = useState<ArtistTrack | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<ArtistRelease | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, r] = await Promise.all([getArtistTracks(), getArtistReleases()]);
        setTracks(t);
        setReleases(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(t => t.title.toLowerCase().includes(q));
  }, [tracks, search]);

  const filteredReleases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter(r => r.title.toLowerCase().includes(q));
  }, [releases, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const totalStreams = tracks.reduce((s, t) => s + (t.streams || 0), 0);

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="py-2 mb-3.5">
          <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>Musique</h1>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {tracks.length} titre{tracks.length > 1 ? 's' : ''} · {fmtMillions(totalStreams)} streams
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-3">
          {(['tracks', 'releases'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-[7px] rounded-full text-[12.5px] font-semibold border"
              style={
                tab === t
                  ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                  : { background: 'var(--surface)', color: 'var(--text-2)', borderColor: 'var(--border)' }
              }
            >
              {t === 'tracks' ? 'Titres' : 'Albums'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5 rounded-[14px] border px-3.5 py-[11px]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} style={{ color: 'var(--text-3)' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Rechercher un ${tab === 'tracks' ? 'titre' : 'album'}…`}
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {error && (
          <div className="mt-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* List */}
        {tab === 'tracks' ? (
          filteredTracks.length === 0 ? (
            <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>Aucun titre</div>
          ) : (
            <div
              className="mt-[14px] rounded-[20px] border px-4 py-1.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
            >
              {filteredTracks.slice(0, 50).map((t, i) => (
                <button
                  key={`${t.isrc || t.title}-${i}`}
                  onClick={() => setSelectedTrack(t)}
                  className={`w-full flex items-center gap-3 py-3 text-left ${i < filteredTracks.length - 1 ? 'border-b' : ''}`}
                  style={i < filteredTracks.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                >
                  <div className="w-[46px] h-[46px] rounded-[11px] flex-none" style={{ background: 'var(--cover)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{t.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {fmtMillions(t.streams || 0)} streams
                    </div>
                  </div>
                  <span className="roy-num text-[13px] font-bold" style={{ color: 'var(--text)' }}>{fmtEUR(t.gross)}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          filteredReleases.length === 0 ? (
            <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>Aucun album</div>
          ) : (
            <div
              className="mt-[14px] rounded-[20px] border px-4 py-1.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
            >
              {filteredReleases.slice(0, 50).map((r, i) => (
                <button
                  key={r.upc}
                  onClick={() => setSelectedRelease(r)}
                  className={`w-full flex items-center gap-3 py-3 text-left ${i < filteredReleases.length - 1 ? 'border-b' : ''}`}
                  style={i < filteredReleases.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                >
                  {r.artwork_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.artwork_url} alt={r.title} className="w-[46px] h-[46px] rounded-[11px] flex-none object-cover" />
                  ) : (
                    <div className="w-[46px] h-[46px] rounded-[11px] flex-none" style={{ background: 'var(--cover)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{r.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {r.track_count} titre{r.track_count > 1 ? 's' : ''} · {fmtMillions(r.streams || 0)}
                    </div>
                  </div>
                  <span className="roy-num text-[13px] font-bold" style={{ color: 'var(--text)' }}>{fmtEUR(r.gross)}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Track detail */}
      <Sheet open={!!selectedTrack} onClose={() => setSelectedTrack(null)}>
        {selectedTrack && (
          <>
            <div className="flex items-center gap-[15px]">
              <div className="w-16 h-16 rounded-[14px] flex-none" style={{ background: 'var(--cover)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold tracking-[-0.02em] truncate" style={{ color: 'var(--text)' }}>{selectedTrack.title}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {selectedTrack.isrc || 'Sans ISRC'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[11px] mt-[18px]">
              <div className="rounded-[16px] border p-4" style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}>
                <div className="roy-eyebrow text-[9px]">Streams</div>
                <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtMillions(selectedTrack.streams || 0)}</div>
              </div>
              <div className="rounded-[16px] border p-4" style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}>
                <div className="roy-eyebrow text-[9px]">Revenus</div>
                <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtEUR(selectedTrack.gross)}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedTrack(null)}
              className="w-full mt-4 py-[14px] rounded-[14px] border text-[13.5px] font-semibold"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              Fermer
            </button>
          </>
        )}
      </Sheet>

      {/* Release detail */}
      <Sheet open={!!selectedRelease} onClose={() => setSelectedRelease(null)}>
        {selectedRelease && (
          <>
            <div className="flex items-center gap-[15px]">
              {selectedRelease.artwork_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedRelease.artwork_url} alt={selectedRelease.title} className="w-16 h-16 rounded-[14px] flex-none object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-[14px] flex-none" style={{ background: 'var(--cover)' }} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold tracking-[-0.02em] truncate" style={{ color: 'var(--text)' }}>{selectedRelease.title}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  UPC {selectedRelease.upc} · {selectedRelease.track_count} titre{selectedRelease.track_count > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[11px] mt-[18px]">
              <div className="rounded-[16px] border p-4" style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}>
                <div className="roy-eyebrow text-[9px]">Streams</div>
                <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtMillions(selectedRelease.streams || 0)}</div>
              </div>
              <div className="rounded-[16px] border p-4" style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}>
                <div className="roy-eyebrow text-[9px]">Revenus</div>
                <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{fmtEUR(selectedRelease.gross)}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedRelease(null)}
              className="w-full mt-4 py-[14px] rounded-[14px] border text-[13.5px] font-semibold"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              Fermer
            </button>
          </>
        )}
      </Sheet>

      <ArtistBottomNav />
    </div>
  );
}
