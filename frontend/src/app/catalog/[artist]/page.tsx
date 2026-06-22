'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@heroui/react';
import { getArtistReleases, getArtistTracks, CatalogRelease, CatalogTrack } from '@/lib/api';
import { Card, Eyebrow, Avatar } from '@/components/roy/ui';

type Tab = 'releases' | 'tracks';

export default function CatalogArtistPage() {
  const params = useParams();
  const artistName = decodeURIComponent(params.artist as string);

  const [tab, setTab] = useState<Tab>('releases');
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [artistName]);

  const loadData = async () => {
    try {
      const [releasesData, tracksData] = await Promise.all([
        getArtistReleases(artistName),
        getArtistTracks(artistName),
      ]);
      setReleases(releasesData);
      setTracks(tracksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'releases', label: 'Releases', count: releases.length },
    { key: 'tracks', label: 'Tracks', count: tracks.length },
  ];

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="px-5 lg:px-7 py-5 border-b border-line">
        <Link href="/catalog" className="text-[12px] text-ink-faint hover:text-ink mb-3 inline-flex items-center gap-1 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Catalogue
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={artistName} size={42} accent />
            <div className="min-w-0">
              <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink truncate">{artistName}</h1>
              <p className="text-[12.5px] text-ink-faint mt-0.5">
                {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                  tab === t.key
                    ? 'bg-accent-soft text-accent font-semibold'
                    : 'text-ink-muted hover:text-ink font-medium'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px] text-neg">{error}</div>
        )}

        {tab === 'releases' && (
          <Card padded={false} className="overflow-hidden">
            {releases.length === 0 ? (
              <div className="px-[22px] py-16 text-center">
                <p className="text-ink-faint text-[13px]">Aucune release</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2.4fr_1fr_1fr_0.9fr] px-[22px] py-3 border-b border-line">
                  <Eyebrow className="text-[10px]">Release</Eyebrow>
                  <Eyebrow className="text-[10px]">Tracks</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Streams</Eyebrow>
                </div>
                {releases.map((release, index) => (
                  <div
                    key={`${release.upc}-${index}`}
                    className="grid grid-cols-[2.4fr_1fr_1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-[9px] shrink-0" style={{ background: 'var(--cover)' }} />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate">{release.release_title}</span>
                        {release.upc && (
                          <span className="block text-[10.5px] text-ink-faint font-mono mt-0.5">UPC {release.upc}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-ink-muted">
                      {release.track_count} track{release.track_count > 1 ? 's' : ''}
                    </span>
                    <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(release.total_gross, release.currency)}</span>
                    <span className="text-right roy-num text-[13px] text-ink-muted">{formatNumber(release.total_streams)}</span>
                  </div>
                ))}
              </>
            )}
          </Card>
        )}

        {tab === 'tracks' && (
          <Card padded={false} className="overflow-hidden">
            {tracks.length === 0 ? (
              <div className="px-[22px] py-16 text-center">
                <p className="text-ink-faint text-[13px]">Aucun track</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2.4fr_1fr_1fr_0.9fr] px-[22px] py-3 border-b border-line">
                  <Eyebrow className="text-[10px]">Track</Eyebrow>
                  <Eyebrow className="text-[10px]">Release</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Revenus</Eyebrow>
                  <Eyebrow className="text-[10px] text-right">Streams</Eyebrow>
                </div>
                {tracks.map((track, index) => (
                  <div
                    key={`${track.isrc}-${index}`}
                    className="grid grid-cols-[2.4fr_1fr_1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-[9px] shrink-0" style={{ background: 'var(--cover)' }} />
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate">{track.track_title}</span>
                        {track.isrc && (
                          <span className="block text-[10.5px] text-ink-faint font-mono mt-0.5">ISRC {track.isrc}</span>
                        )}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-ink-muted truncate pr-2">{track.release_title || '—'}</span>
                    <span className="text-right roy-num text-[13px] font-bold text-ink">{formatCurrency(track.total_gross, track.currency)}</span>
                    <span className="text-right roy-num text-[13px] text-ink-muted">{formatNumber(track.total_streams)}</span>
                  </div>
                ))}
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
