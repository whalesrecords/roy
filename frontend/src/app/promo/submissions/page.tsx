'use client';

import { useState, useEffect } from 'react';
import { Spinner, Badge } from '@heroui/react';
import { getTracksSummary, getPromoSubmissions, getArtists, TrackSummary, PromoSubmission, Artist } from '@/lib/api';
import Link from 'next/link';

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  submithub: { label: 'SubmitHub', color: 'bg-blue-100 text-blue-800' },
  groover: { label: 'Groover', color: 'bg-purple-100 text-purple-800' },
  manual: { label: 'Manuel', color: 'bg-gray-100 text-gray-800' },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  listen: { label: 'Écouté', color: 'bg-blue-100 text-blue-800' },
  declined: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  shared: { label: 'Partagé', color: 'bg-purple-100 text-purple-800' },
  playlist: { label: 'Playlist', color: 'bg-purple-600 text-white' },
};

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
        getArtists({ limit: 500 }),
      ]);
      setTracks(tracksData.tracks);
      setArtists(artistsData.artists);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Submissions Promo</h1>
            <p className="text-gray-600">Vue par track avec métriques d'efficacité</p>
          </div>
          <Link
            href="/promo/import"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Importer CSV
          </Link>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Artiste</label>
            <select
              value={selectedArtist}
              onChange={(e) => {
                setSelectedArtist(e.target.value);
                setSelectedAlbum('');
                setSelectedTrack(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Album</label>
            <select
              value={selectedAlbum}
              onChange={(e) => {
                setSelectedAlbum(e.target.value);
                setSelectedTrack(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      </div>

      {tracks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">Aucune submission promo</p>
          <Link
            href="/promo/import"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Importer maintenant
          </Link>
        </div>
      ) : !selectedTrack ? (
        /* Track Summary View */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Artiste / Album
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Écoutés
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Approuvés
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playlists
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partagés
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Refusés
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sources
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
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
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{track.song_title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{track.artist_name}</div>
                      <div className="text-xs text-gray-500">{track.release_title || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                      {track.total_submissions}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {track.total_listened}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-green-600">{track.total_approved}</div>
                      <div className="text-xs text-gray-500">{approvalRate}%</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-medium text-purple-600">{track.total_playlists}</div>
                      <div className="text-xs text-gray-500">{playlistRate}%</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-purple-600">
                      {track.total_shared}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-red-600">
                      {track.total_declined}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {track.sources.map(source => {
                          const info = SOURCE_LABELS[source] || { label: source, color: 'bg-gray-100 text-gray-800' };
                          return (
                            <span key={source} className={`px-2 py-1 text-xs font-medium rounded-full ${info.color}`}>
                              {info.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Track Detail View */
        <div>
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => setSelectedTrack(null)}
              className="flex items-center text-blue-600 hover:text-blue-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-2xl font-bold mb-2">{selectedTrack.song_title}</h2>
            <p className="text-gray-600 mb-4">
              {selectedTrack.artist_name} {selectedTrack.release_title && `• ${selectedTrack.release_title}`}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedTrack.total_submissions}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{selectedTrack.total_listened}</div>
                <div className="text-xs text-gray-500">Écoutés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{selectedTrack.total_approved}</div>
                <div className="text-xs text-gray-500">Approuvés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{selectedTrack.total_playlists}</div>
                <div className="text-xs text-gray-500">Playlists</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{selectedTrack.total_shared}</div>
                <div className="text-xs text-gray-500">Partagés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{selectedTrack.total_declined}</div>
                <div className="text-xs text-gray-500">Refusés</div>
              </div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({trackSubmissions.length})
            </button>
            <button
              onClick={() => setStatusFilter('listened')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'listened'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Écoutés ({selectedTrack.total_listened})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approuvés ({selectedTrack.total_approved})
            </button>
            <button
              onClick={() => setStatusFilter('playlist')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'playlist'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Playlists ({selectedTrack.total_playlists})
            </button>
            <button
              onClick={() => setStatusFilter('shared')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'shared'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Partagés ({selectedTrack.total_shared})
            </button>
            <button
              onClick={() => setStatusFilter('declined')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === 'declined'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Refusés ({selectedTrack.total_declined})
            </button>
          </div>

          {/* Submissions List */}
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Outlet / Influencer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Feedback
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTrackSubmissions.map((sub) => {
                    const sourceInfo = SOURCE_LABELS[sub.source] || { label: sub.source, color: 'bg-gray-100 text-gray-800' };
                    const status = sub.action || sub.decision || '-';
                    const statusInfo = ACTION_LABELS[status.toLowerCase()] || { label: status, color: 'bg-gray-100 text-gray-800' };
                    const outlet = sub.outlet_name || sub.influencer_name || '-';

                    return (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{outlet}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${sourceInfo.color}`}>
                            {sourceInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {sub.feedback ? (
                            <div className="text-sm text-gray-600 max-w-md">
                              {sub.feedback.substring(0, 100)}
                              {sub.feedback.length > 100 && '...'}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('fr-FR') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
