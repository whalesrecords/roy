'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import {
  getSpotifySuggestions,
  triggerSpotifyScan,
  syncAllArtistPhotos,
  backfillSuggestionIsrcs,
  approveSpotifySuggestion,
  rejectSpotifySuggestion,
  SpotifyTrackSuggestion,
} from '@/lib/api';
import { Card, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconCheck, IconMusic } from '@/components/roy/icons';

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

const STATUS_LABELS: Record<string, { label: string; tone: 'accent' | 'neutral' }> = {
  pending: { label: 'En attente', tone: 'neutral' },
  approved: { label: 'Approuvé', tone: 'accent' },
  rejected: { label: 'Rejeté', tone: 'neutral' },
};

const FILTER_LABELS: Record<FilterStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvés',
  rejected: 'Rejetés',
  all: 'Tous',
};

const SpotifyGlyph = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export default function SpotifySuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SpotifyTrackSuggestion[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [backfillingIsrcs, setBackfillingIsrcs] = useState(false);
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

  const handleSyncPhotos = async () => {
    setSyncingPhotos(true);
    setScanMessage(null);
    try {
      const res = await syncAllArtistPhotos();
      setScanMessage(res.message);
    } catch (e: any) {
      setScanMessage(`Erreur: ${e.message}`);
    } finally {
      setSyncingPhotos(false);
    }
  };

  const handleBackfillIsrcs = async () => {
    setBackfillingIsrcs(true);
    setScanMessage(null);
    try {
      const res = await backfillSuggestionIsrcs();
      setScanMessage(`ISRCs récupérés : ${res.updated} mis à jour, ${res.failed} échecs sur ${res.total} suggestions`);
      load(filter);
    } catch (e: any) {
      setScanMessage(`Erreur: ${e.message}`);
    } finally {
      setBackfillingIsrcs(false);
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
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <SpotifyGlyph size={20} />
          </span>
          <div>
            <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Suggestions Spotify</h1>
            <p className="text-[12.5px] text-ink-faint mt-0.5">Nouvelles sorties détectées automatiquement chaque semaine</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <OutlineButton onClick={handleBackfillIsrcs}>
            {backfillingIsrcs ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            )}
            Récupérer ISRCs
          </OutlineButton>
          <OutlineButton onClick={handleSyncPhotos}>
            {syncingPhotos ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            Sync photos
          </OutlineButton>
          <AccentButton onClick={handleScan} disabled={scanning}>
            {scanning ? (
              <Spinner size="sm" color="white" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Scanner maintenant
          </AccentButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {scanMessage && (
          <div className="rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-muted">
            {scanMessage}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] font-${filter === f ? 'semibold' : 'medium'} transition-colors inline-flex items-center ${filter === f ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'}`}
            >
              {FILTER_LABELS[f]}
              {f === 'pending' && filter === 'pending' && pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-accent text-accent-ink text-[10px] font-bold rounded-full leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {/* Suggestions list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" color="primary" />
          </div>
        ) : suggestions.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-ink-faint">
              <span className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-2 text-ink-faint flex items-center justify-center">
                <IconMusic size={24} />
              </span>
              <p className="text-[13.5px] font-semibold text-ink">Aucune suggestion</p>
              <p className="text-[12.5px] mt-1">
                {filter === 'pending'
                  ? 'Lance un scan ou attends le prochain scan hebdomadaire.'
                  : 'Pas de résultats pour ce filtre.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {suggestions.map(s => (
              <Card
                key={s.id}
                className={`flex items-center gap-4 ${s.status === 'pending' ? '' : 'opacity-70'}`}
              >
                {/* Album art */}
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image_url}
                    alt={s.album_name}
                    className="w-14 h-14 rounded-[10px] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-[10px] bg-surface-2 text-ink-faint flex items-center justify-center shrink-0">
                    <IconMusic size={22} />
                  </div>
                )}

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-ink truncate">{s.track_name}</p>
                    {s.album_type && (
                      <span className="px-1.5 py-0.5 bg-surface-2 text-ink-muted text-[10px] rounded-[6px] uppercase tracking-wide font-semibold">
                        {s.album_type}
                      </span>
                    )}
                    <Pill tone={STATUS_LABELS[s.status]?.tone ?? 'neutral'}>
                      {STATUS_LABELS[s.status]?.label ?? s.status}
                    </Pill>
                  </div>
                  <p className="text-[12.5px] text-ink-muted truncate mt-0.5">
                    {s.artist_name} — {s.album_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-ink-faint">
                    {s.release_date && <span>{formatDate(s.release_date)}</span>}
                    {s.isrc && <span className="font-mono">ISRC: {s.isrc}</span>}
                    {s.duration_ms && <span>{formatDuration(s.duration_ms)}</span>}
                    {s.label_name && <span>{s.label_name}</span>}
                    {s.spotify_url && (
                      <a
                        href={s.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-1 font-semibold"
                      >
                        <SpotifyGlyph size={12} />
                        Écouter
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {s.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={actionId === s.id}
                      className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3.5 py-2 text-[12px] font-bold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {actionId === s.id ? <Spinner size="sm" color="white" /> : <IconCheck size={14} />}
                      Ajouter
                    </button>
                    <button
                      onClick={() => handleReject(s.id)}
                      disabled={actionId === s.id}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Ignorer
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
