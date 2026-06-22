'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { getTracksSummary, getPromoSubmissions, getArtists, TrackSummary, PromoSubmission, Artist } from '@/lib/api';
import Link from 'next/link';
import { Card, Eyebrow, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconImport, IconChevronRight } from '@/components/roy/icons';

type Tone = 'accent' | 'neutral' | 'neg';

const SOURCE_LABELS: Record<string, { label: string; tone: Tone }> = {
  submithub: { label: 'SubmitHub', tone: 'accent' },
  groover: { label: 'Groover', tone: 'accent' },
  manual: { label: 'Manuel', tone: 'neutral' },
};

const ACTION_LABELS: Record<string, { label: string; tone: Tone }> = {
  listen: { label: 'Écouté', tone: 'neutral' },
  declined: { label: 'Refusé', tone: 'neg' },
  approved: { label: 'Approuvé', tone: 'accent' },
  shared: { label: 'Partagé', tone: 'neutral' },
  playlist: { label: 'Playlist', tone: 'accent' },
};

// Small status pill that supports a negative tone in addition to the shared Pill tones.
function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  if (tone === 'neg') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold bg-surface-2 text-neg">
        {label}
      </span>
    );
  }
  return <Pill tone={tone}>{label}</Pill>;
}

export default function PromoSubmissionsPage() {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);
  const [trackSubmissions, setTrackSubmissions] = useState<PromoSubmission[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedArtist, selectedAlbum]);

  useEffect(() => {
    if (selectedTrack) {
      loadTrackSubmissions();
    }
  }, [selectedTrack]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tracksData, artistsData] = await Promise.all([
        getTracksSummary({
          artist_id: selectedArtist || undefined,
          release_upc: selectedAlbum || undefined,
        }),
        getArtists(),
      ]);
      setTracks(tracksData.tracks);
      setArtists(artistsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTrackSubmissions = async () => {
    if (!selectedTrack) return;

    try {
      setDetailLoading(true);
      const result = await getPromoSubmissions({
        artist_id: selectedTrack.artist_id,
        limit: 500,
      });

      // Filter submissions for this specific track
      const filtered = result.submissions.filter(
        sub => sub.song_title === selectedTrack.song_title &&
               sub.release_upc === selectedTrack.release_upc
      );
      setTrackSubmissions(filtered);
    } catch (err: any) {
      console.error('Error loading track submissions:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Get unique albums from tracks
  const albums = Array.from(new Set(tracks.map(t => t.release_title).filter(Boolean)));
  const albumsWithUpc = tracks.reduce((acc, track) => {
    if (track.release_title && track.release_upc) {
      acc[track.release_title] = track.release_upc;
    }
    return acc;
  }, {} as Record<string, string>);

  // Filter track submissions by status
  const filteredTrackSubmissions = trackSubmissions.filter(sub => {
    if (statusFilter === 'all') return true;

    const action = (sub.action || '').toLowerCase();
    const decision = (sub.decision || '').toLowerCase();

    if (statusFilter === 'listened' && action.includes('listen')) return true;
    if (statusFilter === 'approved' && (action.includes('approved') || decision.includes('approved') || decision.includes('accepted'))) return true;
    if (statusFilter === 'declined' && (action.includes('declined') || decision.includes('declined') || decision.includes('rejected'))) return true;
    if (statusFilter === 'shared' && (action.includes('shared') || decision.includes('shar'))) return true;
    if (statusFilter === 'playlist' && (decision.includes('playlist') || decision.includes('added'))) return true;

    return false;
  });

  const selectClass =
    'w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

  const STATUS_FILTERS: { key: string; label: string; count: number }[] = selectedTrack
    ? [
        { key: 'all', label: 'Tous', count: trackSubmissions.length },
        { key: 'listened', label: 'Écoutés', count: selectedTrack.total_listened },
        { key: 'approved', label: 'Approuvés', count: selectedTrack.total_approved },
        { key: 'playlist', label: 'Playlists', count: selectedTrack.total_playlists },
        { key: 'shared', label: 'Partagés', count: selectedTrack.total_shared },
        { key: 'declined', label: 'Refusés', count: selectedTrack.total_declined },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Submissions Promo</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Vue par track avec métriques d'efficacité</p>
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

        {!selectedTrack && (
          /* Filters */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Artiste</label>
              <select
                value={selectedArtist}
                onChange={(e) => {
                  setSelectedArtist(e.target.value);
                  setSelectedAlbum('');
                  setSelectedTrack(null);
                }}
                className={selectClass}
              >
                <option value="">Tous les artistes</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Album</label>
              <select
                value={selectedAlbum}
                onChange={(e) => {
                  setSelectedAlbum(e.target.value);
                  setSelectedTrack(null);
                }}
                className={selectClass}
              >
                <option value="">Tous les albums</option>
                {albums.map((album) => (
                  <option key={album} value={albumsWithUpc[album as string]}>
                    {album}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tracks.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-ink-faint text-[14px] mb-4">Aucune submission promo</p>
            <div className="flex justify-center">
              <Link href="/promo/import">
                <AccentButton>
                  <IconImport size={14} /> Importer maintenant
                </AccentButton>
              </Link>
            </div>
          </Card>
        ) : !selectedTrack ? (
          /* Track Summary View */
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-[22px] py-3"><Eyebrow>Track</Eyebrow></th>
                    <th className="px-3 py-3"><Eyebrow>Artiste / Album</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Total</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Écoutés</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Approuvés</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Playlists</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Partagés</Eyebrow></th>
                    <th className="px-3 py-3 text-center"><Eyebrow>Refusés</Eyebrow></th>
                    <th className="px-[22px] py-3"><Eyebrow>Sources</Eyebrow></th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track) => {
                    const approvalRate = track.total_submissions > 0
                      ? Math.round((track.total_approved / track.total_submissions) * 100)
                      : 0;
                    const playlistRate = track.total_submissions > 0
                      ? Math.round((track.total_playlists / track.total_submissions) * 100)
                      : 0;

                    return (
                      <tr
                        key={`${track.artist_id}-${track.song_title}-${track.release_upc}`}
                        onClick={() => setSelectedTrack(track)}
                        className="border-b border-line last:border-0 hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        <td className="px-[22px] py-4">
                          <div className="text-[13px] font-semibold text-ink">{track.song_title}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-[13px] text-ink">{track.artist_name}</div>
                          <div className="text-[11px] text-ink-faint mt-0.5">{track.release_title || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-4 text-center roy-num text-[13px] font-semibold text-ink">
                          {track.total_submissions}
                        </td>
                        <td className="px-3 py-4 text-center roy-num text-[13px] text-ink-muted">
                          {track.total_listened}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <div className="roy-num text-[13px] font-semibold text-accent">{track.total_approved}</div>
                          <div className="text-[11px] text-ink-faint">{approvalRate}%</div>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <div className="roy-num text-[13px] font-semibold text-ink">{track.total_playlists}</div>
                          <div className="text-[11px] text-ink-faint">{playlistRate}%</div>
                        </td>
                        <td className="px-3 py-4 text-center roy-num text-[13px] text-ink-muted">
                          {track.total_shared}
                        </td>
                        <td className="px-3 py-4 text-center roy-num text-[13px] text-neg">
                          {track.total_declined}
                        </td>
                        <td className="px-[22px] py-4">
                          <div className="flex flex-wrap gap-1">
                            {track.sources.map(source => {
                              const info = SOURCE_LABELS[source] || { label: source, tone: 'neutral' as Tone };
                              return <StatusPill key={source} label={info.label} tone={info.tone} />;
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Track Detail View */
          <>
            <button
              onClick={() => setSelectedTrack(null)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <IconChevronRight size={15} className="rotate-180" />
              Retour
            </button>

            <Card>
              <h2 className="text-[18px] font-bold text-ink">{selectedTrack.song_title}</h2>
              <p className="text-[13px] text-ink-faint mt-1 mb-5">
                {selectedTrack.artist_name} {selectedTrack.release_title && `· ${selectedTrack.release_title}`}
              </p>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total', value: selectedTrack.total_submissions, accent: false },
                  { label: 'Écoutés', value: selectedTrack.total_listened, accent: false },
                  { label: 'Approuvés', value: selectedTrack.total_approved, accent: true },
                  { label: 'Playlists', value: selectedTrack.total_playlists, accent: true },
                  { label: 'Partagés', value: selectedTrack.total_shared, accent: false },
                  { label: 'Refusés', value: selectedTrack.total_declined, accent: false, neg: true },
                ].map((m) => (
                  <div key={m.label} className="bg-surface-2 rounded-[12px] p-4 text-center">
                    <div className={`roy-num text-[22px] font-bold ${m.accent ? 'text-accent' : m.neg ? 'text-neg' : 'text-ink'}`}>
                      {m.value}
                    </div>
                    <Eyebrow>{m.label}</Eyebrow>
                  </div>
                ))}
              </div>
            </Card>

            {/* Status Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-[10px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === f.key
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface border border-line text-ink-muted hover:text-ink'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {/* Submissions List */}
            {detailLoading ? (
              <Card className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </Card>
            ) : (
              <Card padded={false} className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="px-[22px] py-3"><Eyebrow>Outlet / Influencer</Eyebrow></th>
                        <th className="px-3 py-3"><Eyebrow>Source</Eyebrow></th>
                        <th className="px-3 py-3"><Eyebrow>Status</Eyebrow></th>
                        <th className="px-3 py-3"><Eyebrow>Feedback</Eyebrow></th>
                        <th className="px-[22px] py-3"><Eyebrow>Date</Eyebrow></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrackSubmissions.map((sub) => {
                        const sourceInfo = SOURCE_LABELS[sub.source] || { label: sub.source, tone: 'neutral' as Tone };
                        const status = sub.action || sub.decision || '-';
                        const statusInfo = ACTION_LABELS[status.toLowerCase()] || { label: status, tone: 'neutral' as Tone };
                        const outlet = sub.outlet_name || sub.influencer_name || '-';

                        return (
                          <tr key={sub.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                            <td className="px-[22px] py-4 text-[13px] text-ink">{outlet}</td>
                            <td className="px-3 py-4">
                              <StatusPill label={sourceInfo.label} tone={sourceInfo.tone} />
                            </td>
                            <td className="px-3 py-4">
                              <StatusPill label={statusInfo.label} tone={statusInfo.tone} />
                            </td>
                            <td className="px-3 py-4">
                              {sub.feedback ? (
                                <div className="text-[12.5px] text-ink-muted max-w-md">
                                  {sub.feedback.substring(0, 100)}
                                  {sub.feedback.length > 100 && '...'}
                                </div>
                              ) : (
                                <span className="text-ink-faint">-</span>
                              )}
                            </td>
                            <td className="px-[22px] py-4 text-[12.5px] text-ink-faint">
                              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('fr-FR') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
