'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import {
  importMetaAdsCSV, getMetaAdCampaigns, deleteMetaAdCampaign,
  ImportMetaAdsResult, MetaAdCampaign,
} from '@/lib/api';
import { Card, Eyebrow, AccentButton } from '@/components/roy/ui';
import { IconCheck, IconDownload } from '@/components/roy/icons';

const fmtEUR = (v?: string | number | null, cur = 'EUR') =>
  v == null ? '—' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 2 });
const fmtNum = (v?: number | null) =>
  v == null ? '—' : v >= 1_000_000 ? `${(v / 1e6).toFixed(2)} M` : v >= 1000 ? `${(v / 1000).toFixed(1)} K` : String(v);
const fmtInt = (v?: number | null) => (v == null ? '—' : v.toLocaleString('fr-FR'));
const fmtDec = (v?: string | null) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
};

function DetailStat({ label, value }: { label: string; value: string }) {
  if (value === '—') return null;
  return (
    <div className="rounded-[10px] bg-surface px-3 py-2 border border-line">
      <div className="roy-num text-[14px] font-bold text-ink">{value}</div>
      <div className="text-[10px] text-ink-faint leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function CampaignRow({ c, onDelete, deleting }: { c: MetaAdCampaign; onDelete: (id: string) => void; deleting: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <div className="grid grid-cols-[1.7fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_auto] items-center px-[22px] py-3 hover:bg-surface-2 transition-colors">
        <button onClick={() => setOpen((v) => !v)} className="contents text-left">
          <div className="min-w-0 pr-2">
            <div className="text-[13px] font-semibold text-ink truncate">{c.title || c.ad_name}</div>
            <div className="text-[11px] text-ink-faint truncate">
              {[c.platform, c.start_date].filter(Boolean).join(' · ')}{c.track_isrc || c.release_upc ? ' · catalogue ✓' : ''}
            </div>
          </div>
          <div className="text-[12.5px] text-ink-muted truncate pr-2">{c.artist_name || '—'}</div>
          <div className="text-right roy-num text-[13px] font-bold text-ink">{fmtEUR(c.spend, c.currency)}</div>
          <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtNum(c.reach)}</div>
          <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtNum(c.impressions)}</div>
          <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtInt(c.link_clicks)}</div>
        </button>
        <button
          onClick={() => onDelete(c.id)}
          disabled={deleting}
          title="Supprimer cette publicité"
          aria-label="Supprimer cette publicité"
          className="justify-self-end ml-2 p-1.5 rounded-md text-ink-faint hover:text-neg hover:bg-surface transition-colors disabled:opacity-50"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="px-[22px] pb-4 pt-1 bg-surface-2/40">
          <Eyebrow className="text-[10px]">Performance</Eyebrow>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
            <DetailStat label="Couverture" value={fmtInt(c.reach)} />
            <DetailStat label="Impressions" value={fmtInt(c.impressions)} />
            <DetailStat label="Clics (lien)" value={fmtInt(c.link_clicks)} />
            <DetailStat label="Clics (tous)" value={fmtInt(c.clicks_all)} />
            <DetailStat label={c.result_type || 'Résultats'} value={fmtInt(c.results)} />
            <DetailStat label="CPC (lien)" value={fmtEUR(c.cpc, c.currency)} />
            <DetailStat label="CPM" value={fmtEUR(c.cpm, c.currency)} />
            <DetailStat label="CTR (%)" value={fmtDec(c.ctr)} />
          </div>
          {(c.platform || c.start_date) && (
            <p className="text-[11px] text-ink-faint mt-3">
              {[c.platform, c.start_date && c.end_date ? `${c.start_date} → ${c.end_date}` : c.start_date].filter(Boolean).join(' · ')}
            </p>
          )}
          {deleting && <p className="text-[11px] text-ink-faint mt-3">Suppression…</p>}
        </div>
      )}
    </div>
  );
}

export default function MetaAdsUploadFlow({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportMetaAdsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<MetaAdCampaign[]>([]);
  const [totalSpend, setTotalSpend] = useState('0');
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getMetaAdCampaigns();
      setCampaigns(data.campaigns);
      setTotalSpend(data.total_spend);
    } catch { /* ignore */ } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette publicité ? L'avance récupérable liée sera annulée — le montant ne sera plus déduit des royalties de l'artiste.")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteMetaAdCampaign(id);
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await importMetaAdsCSV(file);
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
            <p className="text-[13px] text-ink font-medium">Glissez l&apos;export CSV de Meta Ads Manager (Facebook / Instagram)</p>
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
          {importing ? <Spinner size="sm" /> : <IconCheck size={14} />} Importer les publicités
        </AccentButton>
        <p className="text-[11.5px] text-ink-faint">
          L&apos;artiste est détecté via le titre de la publicité rattaché au catalogue ; la dépense est enregistrée comme avance récupérable (catégorie Meta Ads).
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
            <div><Eyebrow>Mises à jour</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{result.updated_count ?? 0}</div></div>
            <div><Eyebrow>Dépense importée</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{fmtEUR(result.total_spend)}</div></div>
            <div><Eyebrow>Reliées au catalogue</Eyebrow><div className="roy-num text-[18px] font-bold text-ink">{result.matched_campaigns}</div></div>
          </div>
          {result.artists_not_found.length > 0 && (
            <p className="text-[12px] text-ink-muted mt-3">
              Pubs non rattachées (titre introuvable au catalogue) : <span className="text-ink">{result.artists_not_found.join(', ')}</span>.
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
          <h3 className="text-[14px] font-semibold text-ink">Publicités importées</h3>
          {!loadingList && campaigns.length > 0 && (
            <span className="text-[12px] text-ink-faint">Total dépensé · <span className="roy-num font-semibold text-ink">{fmtEUR(totalSpend)}</span></span>
          )}
        </div>
        {loadingList ? (
          <div className="flex justify-center py-10"><Spinner color="primary" /></div>
        ) : campaigns.length === 0 ? (
          <Card className="text-center py-10"><p className="text-[13px] text-ink-faint">Aucune publicité importée pour le moment.</p></Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="grid grid-cols-[1.7fr_1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_auto] px-[22px] py-3 border-b border-line">
              {['Publicité', 'Artiste', 'Dépensé', 'Portée', 'Impr.', 'Clics'].map((h, i) => (
                <Eyebrow key={h} className={`text-[10px] ${i >= 2 ? 'text-right' : ''}`}>{h}</Eyebrow>
              ))}
              <span className="w-[15px]" />
            </div>
            {campaigns.map((c) => <CampaignRow key={c.id} c={c} onDelete={handleDelete} deleting={deletingId === c.id} />)}
            <p className="px-[22px] py-2.5 text-[11px] text-ink-faint">Cliquez sur une publicité pour voir tous les résultats détaillés.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
