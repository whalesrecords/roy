'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import {
  importSpotifyAdsCSV, getSpotifyAdCampaigns,
  ImportSpotifyAdsResult, SpotifyAdCampaign,
} from '@/lib/api';
import { Card, Eyebrow, Pill, AccentButton } from '@/components/roy/ui';
import { IconCheck, IconDownload } from '@/components/roy/icons';

const fmtEUR = (v?: string | number | null, cur = 'EUR') =>
  v == null ? '—' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 2 });
const fmtNum = (v?: number | null) =>
  v == null ? '—' : v >= 1_000_000 ? `${(v / 1e6).toFixed(2)} M` : v >= 1000 ? `${(v / 1000).toFixed(1)} K` : String(v);

export default function SpotifyAdsUploadFlow({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSpotifyAdsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<SpotifyAdCampaign[]>([]);
  const [totalSpend, setTotalSpend] = useState('0');
  const [loadingList, setLoadingList] = useState(true);

  const loadCampaigns = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getSpotifyAdCampaigns();
      setCampaigns(data.campaigns);
      setTotalSpend(data.total_spend);
    } catch { /* ignore */ } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importSpotifyAdsCSV(file);
      setResult(res);
      setFile(null);
      await loadCampaigns();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith('.csv')) setFile(f);
        }}
        className={`rounded-[16px] border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'
        }`}
      >
        <svg className="w-9 h-9 mx-auto text-ink-faint mb-3" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {file ? (
          <p className="text-[13px] text-ink font-medium">{file.name}</p>
        ) : (
          <>
            <p className="text-[13px] text-ink font-medium">Glissez le CSV « Campaigns » de Spotify Ad Studio</p>
            <p className="text-[11.5px] text-ink-faint mt-1">ou</p>
          </>
        )}
        <label className="inline-flex items-center gap-1.5 mt-3 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer">
          <IconDownload size={14} /> Choisir un fichier
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <AccentButton onClick={handleImport} disabled={!file || importing}>
          {importing ? <Spinner size="sm" /> : <IconCheck size={14} />} Importer les campagnes
        </AccentButton>
        <p className="text-[11.5px] text-ink-faint">
          Les artistes sont reconnus par leur nom ; la dépense est enregistrée comme avance récupérable (catégorie Spotify Ads).
        </p>
      </div>

      {error && (
        <div className="rounded-[12px] bg-neg/10 border border-neg/20 px-4 py-3 text-[12.5px] text-neg">{error}</div>
      )}

      {/* Import result */}
      {result && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div><Eyebrow>Créées</Eyebrow><div className="roy-num text-[18px] font-bold text-accent">{result.created_count}</div></div>
            <div><Eyebrow>Doublons ignorés</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{result.skipped_duplicates}</div></div>
            <div><Eyebrow>Dépense importée</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{fmtEUR(result.total_spend)}</div></div>
            <div><Eyebrow>Reliées au catalogue</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{result.matched_campaigns}</div></div>
          </div>
          {result.artists_not_found.length > 0 && (
            <p className="text-[12px] text-ink-muted mt-3">
              Artistes non trouvés : <span className="text-ink">{result.artists_not_found.join(', ')}</span> — créez-les dans Artistes puis réimportez.
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="text-[11.5px] text-ink-faint mt-2 list-disc pl-4 space-y-0.5">
              {result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </Card>
      )}

      {/* Existing campaigns */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-ink">Campagnes importées</h3>
          {!loadingList && campaigns.length > 0 && (
            <span className="text-[12px] text-ink-faint">Total dépensé · <span className="roy-num font-semibold text-ink">{fmtEUR(totalSpend)}</span></span>
          )}
        </div>
        {loadingList ? (
          <div className="flex justify-center py-10"><Spinner color="primary" /></div>
        ) : campaigns.length === 0 ? (
          <Card className="text-center py-10"><p className="text-[13px] text-ink-faint">Aucune campagne importée pour le moment.</p></Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="grid grid-cols-[1.6fr_1.2fr_0.9fr_0.8fr_0.8fr_0.9fr] px-[22px] py-3 border-b border-line">
              {['Campagne', 'Artiste', 'Dépensé', 'Portée', 'Clics', 'Conv.'].map((h, i) => (
                <Eyebrow key={h} className={`text-[10px] ${i >= 2 ? 'text-right' : ''}`}>{h}</Eyebrow>
              ))}
            </div>
            {campaigns.map((c) => (
              <div key={c.id} className="grid grid-cols-[1.6fr_1.2fr_0.9fr_0.8fr_0.8fr_0.9fr] items-center px-[22px] py-3 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                <div className="min-w-0 pr-2">
                  <div className="text-[13px] font-semibold text-ink truncate">{c.release_name || c.campaign_name}</div>
                  <div className="text-[11px] text-ink-faint">{c.start_date || ''}{c.track_isrc || c.release_upc ? ' · catalogue ✓' : ''}</div>
                </div>
                <div className="text-[12.5px] text-ink-muted truncate pr-2">{c.artist_name || '—'}</div>
                <div className="text-right roy-num text-[13px] font-bold text-ink">{fmtEUR(c.spend, c.currency)}</div>
                <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtNum(c.reach)}</div>
                <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtNum(c.clicks)}</div>
                <div className="text-right roy-num text-[12.5px] text-ink-muted">{c.conversion_rate ? `${c.conversion_rate}%` : '—'}</div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
