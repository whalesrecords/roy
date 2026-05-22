'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import {
  getSpotifySuggestions,
  triggerSpotifyScan,
  approveSpotifySuggestion,
  rejectSpotifySuggestion,
  SpotifyTrackSuggestion,
} from '@/lib/api';

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all';

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(str?: string): string {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('fr-FR');
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approuvé', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800' },
};

export default function SpotifySuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SpotifyTrackSuggestion[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: FilterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSpotifySuggestions(f);
      setSuggestions(data);
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const handleScan = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await triggerSpotifyScan();
      setScanMessage(res.message);
    } catch (e: any) {
      setScanMessage(`Erreur: ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await approveSpotifySuggestion(id);
      setSuggestions(prev =>
        filter === 'pending'
          ? prev.filter(s => s.id !== id)
          : prev.map(s => s.id === id ? { ...s, status: 'approved' } : s)
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    try {
      await rejectSpotifySuggestion(id);
      setSuggestions(prev =>
        filter === 'pending'
          ? prev.filter(s => s.id !== id)
          : prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s)
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Suggestions Spotify
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Nouvelles sorties détectées automatiquement chaque semaine
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {scanning ? (
            <Spinner size="sm" color="white" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Scanner maintenant
        </button>
      </div>

      {scanMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          {scanMessage}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pending' && 'En attente'}
            {f === 'approved' && 'Approuvés'}
            {f === 'rejected' && 'Rejetés'}
            {f === 'all' && 'Tous'}
            {f === 'pending' && filter === 'pending' && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Suggestions list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="font-medium">Aucune suggestion</p>
          <p className="text-sm mt-1">
            {filter === 'pending'
              ? 'Lance un scan ou attends le prochain scan hebdomadaire.'
              : 'Pas de résultats pour ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => (
            <div
              key={s.id}
              className={`bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm ${
                s.status === 'pending' ? 'border-gray-200' : 'border-gray-100 opacity-75'
              }`}
            >
              {/* Album art */}
              {s.image_url ? (
                <img
                  src={s.image_url}
                  alt={s.album_name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </div>
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 truncate">{s.track_name}</p>
                  {s.album_type && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded uppercase tracking-wide">
                      {s.album_type}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[s.status]?.className}`}>
                    {STATUS_LABELS[s.status]?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {s.artist_name} — {s.album_name}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-400">
                  {s.release_date && <span>📅 {formatDate(s.release_date)}</span>}
                  {s.isrc && <span className="font-mono">ISRC: {s.isrc}</span>}
                  {s.duration_ms && <span>⏱ {formatDuration(s.duration_ms)}</span>}
                  {s.label_name && <span>🏷 {s.label_name}</span>}
                  {s.spotify_url && (
                    <a
                      href={s.spotify_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      Écouter
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              {s.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(s.id)}
                    disabled={actionId === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionId === s.id ? <Spinner size="sm" color="white" /> : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Ajouter
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={actionId === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Ignorer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
