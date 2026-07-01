'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import {
  AssetsSummary,
  FixedAsset,
  createAsset,
  deleteAsset,
  getAssets,
  getAssetsSummary,
  importReverbAssets,
  scrapeAssetPhotos,
  updateAsset,
} from '@/lib/api';
import { Card, Eyebrow, Pill, Kpi, AccentButton, OutlineButton } from '@/components/roy/ui';
import { useConfirm } from '@/components/roy/useConfirm';
import { IconPlus, IconImport, IconChart } from '@/components/roy/icons';

const CATEGORY_LABELS: Record<string, string> = {
  construction: 'Construction',
  studio_gear: 'Matériel studio',
  tooling: 'Outillage',
  fittings: 'Agencements',
  vehicle: 'Transport',
  computer: 'Informatique',
  software: 'Logiciels',
  other: 'Autre',
};

const METHOD_LABELS: Record<string, string> = {
  linear: 'Linéaire',
  degressive: 'Dégressif',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'En service',
  disposed: 'Mis au rebut',
  sold: 'Cédé',
};

const PCG_LABELS: Record<string, string> = {
  '213100': '213100 — Constructions',
  '215400': '215400 — Matériel studio',
  '215410': '215410 — Matériel et outillage',
  '218100': '218100 — Agencements',
  '218200': '218200 — Transport',
  '218300': '218300 — Bureau & info.',
  '218800': '218800 — Autres immo. corp.',
  '205000': '205000 — Logiciels',
};

const emptyAsset: Partial<FixedAsset> = {
  name: '',
  category: 'studio_gear',
  pcg_account: '215400',
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_amount_ht: 0,
  vat_rate: 20,
  useful_life_months: 96,
  depreciation_method: 'linear',
  status: 'active',
};

const fmtEUR = (n: number) =>
  (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const inputClass =
  'w-full h-11 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

export default function AssetsTab() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);
  const [scheduleAsset, setScheduleAsset] = useState<FixedAsset | null>(null);
  const [formData, setFormData] = useState<Partial<FixedAsset>>(emptyAsset);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDate, setImportDate] = useState('');
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      setError(null);
      const params: { category?: string; status?: string; search?: string } = {};
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [list, sum] = await Promise.all([getAssets(params), getAssetsSummary()]);
      setAssets(list);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [categoryFilter, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await createAsset(formData);
      setShowCreate(false);
      setFormData(emptyAsset);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await updateAsset(editing.id, formData);
      setEditing(null);
      setFormData(emptyAsset);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: 'Supprimer cette immobilisation ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer' }))) return;
    setDeleting(id);
    try {
      await deleteAsset(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleScrapePhotos = async () => {
    setScraping(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await scrapeAssetPhotos();
      await load();
      setSuccessMsg(
        `${res.updated} photo${res.updated > 1 ? 's' : ''} récupérée${res.updated > 1 ? 's' : ''} sur Reverb` +
          (res.not_found > 0 ? ` — ${res.not_found} introuvable${res.not_found > 1 ? 's' : ''}.` : '.')
      );
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération des photos');
    } finally {
      setScraping(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await importReverbAssets(importFile, importDate || undefined);
      await load();
      const parts: string[] = [];
      if (res.created > 0) parts.push(`${res.created} ajoutée${res.created > 1 ? 's' : ''}`);
      if (res.skipped > 0) parts.push(`${res.skipped} ignorée${res.skipped > 1 ? 's' : ''}`);
      setSuccessMsg(parts.length ? parts.join(' • ') + '.' : 'Aucune nouvelle immobilisation importée.');
      if (res.errors.length) setError(res.errors.slice(0, 5).join(' | '));
      setShowImport(false);
      setImportFile(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (a: FixedAsset) => {
    setFormData({
      ...a,
      purchase_amount_ht: Number(a.purchase_amount_ht),
      vat_rate: Number(a.vat_rate),
    });
    setEditing(a);
  };

  const isModal = showCreate || editing !== null;
  const isEdit = editing !== null;

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <OutlineButton onClick={handleScrapePhotos} disabled={scraping}>
          {scraping ? 'Récupération...' : 'Récupérer photos manquantes'}
        </OutlineButton>
        <OutlineButton onClick={() => { setShowImport(true); setImportFile(null); }}>
          <IconImport size={14} /> Import Reverb CSV
        </OutlineButton>
        <AccentButton onClick={() => { setFormData(emptyAsset); setShowCreate(true); }}>
          <IconPlus size={14} /> Nouvelle immobilisation
        </AccentButton>
      </div>

      {error && (
        <div className="bg-surface border border-line rounded-[16px] px-4 py-3 text-[12.5px] text-neg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 underline shrink-0 text-ink-muted hover:text-ink">Fermer</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-surface border border-line rounded-[16px] px-4 py-3 text-[12.5px] text-accent flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-4 underline shrink-0 text-ink-muted hover:text-ink">Fermer</button>
        </div>
      )}

      {/* Summary KPIs */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Kpi label="Immobilisations" value={String(summary.total_count)} />
            <Kpi label="Valeur brute" value={fmtEUR(summary.total_gross_value)} />
            <Kpi label="VNC actuelle" value={fmtEUR(summary.total_net_book_value)} hero accentValue />
            <Kpi label={`Dotation ${new Date().getFullYear()}`} value={fmtEUR(summary.current_year_charge)} />
          </div>

          {Object.keys(summary.by_pcg_account).length > 0 && (
            <Card>
              <Eyebrow>Répartition par compte PCG</Eyebrow>
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(summary.by_pcg_account)
                  .sort(([, a], [, b]) => b - a)
                  .map(([acc, gross]) => (
                    <span
                      key={acc}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-[5px] text-[11px] font-semibold text-ink-muted"
                    >
                      {PCG_LABELS[acc] || acc} · <span className="roy-num text-ink">{fmtEUR(gross)}</span>
                    </span>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          {fetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-faint">…</span>
          )}
          <input
            type="text"
            placeholder="Rechercher une immobilisation…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="h-11 w-full px-3.5 rounded-[10px] bg-surface border border-line text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-11 px-3.5 rounded-[10px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
        >
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-11 px-3.5 rounded-[10px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {assets.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-ink-faint text-[13px]">Aucune immobilisation</p>
          <div className="mt-4 flex justify-center">
            <AccentButton onClick={() => { setFormData(emptyAsset); setShowCreate(true); }}>
              <IconPlus size={14} /> Ajouter une immobilisation
            </AccentButton>
          </div>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {/* Header row */}
              <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr_1fr_1.1fr_0.9fr] px-[22px] py-3 border-b border-line">
                <Eyebrow className="text-[10px]">Désignation</Eyebrow>
                <Eyebrow className="text-[10px]">Compte</Eyebrow>
                <Eyebrow className="text-[10px]">Acquis le</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Valeur HT</Eyebrow>
                <Eyebrow className="text-[10px]">Durée</Eyebrow>
                <Eyebrow className="text-[10px] text-right">VNC</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Dotation {new Date().getFullYear()}</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Actions</Eyebrow>
              </div>
              {assets.map(a => (
                <div
                  key={a.id}
                  className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr_1fr_1.1fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    {a.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-[10px] object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-[10px] bg-surface-2 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{a.name}</p>
                      <p className="text-[11px] text-ink-faint truncate">
                        {CATEGORY_LABELS[a.category] || a.category}
                        {a.supplier ? ` · ${a.supplier}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11.5px] text-ink-muted font-mono">{a.pcg_account}</div>
                  <div className="text-[12.5px] text-ink">{a.purchase_date}</div>
                  <div className="text-right roy-num text-[13px] text-ink">{fmtEUR(Number(a.purchase_amount_ht))}</div>
                  <div className="text-[11.5px] text-ink-muted">
                    <span className="roy-num">{a.useful_life_months}</span> mois · {METHOD_LABELS[a.depreciation_method] || a.depreciation_method}
                  </div>
                  <div className="text-right roy-num text-[13px] font-bold text-ink">{fmtEUR(a.net_book_value)}</div>
                  <div className="text-right roy-num text-[13px] text-ink-muted">{fmtEUR(a.annual_charge_current_year)}</div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setScheduleAsset(a)}
                      className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-accent transition-colors"
                      title="Voir le plan d'amortissement"
                    >
                      <IconChart size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-ink transition-colors"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                      className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-neg transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Schedule modal */}
      {scheduleAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setScheduleAsset(null)}>
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink">{scheduleAsset.name}</h2>
              <p className="text-[12.5px] text-ink-faint mt-0.5">
                Plan d&apos;amortissement {METHOD_LABELS[scheduleAsset.depreciation_method] || scheduleAsset.depreciation_method.toLowerCase()} sur {scheduleAsset.useful_life_months} mois
              </p>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[64vh]">
              <div className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr_1.2fr] px-1 py-2 border-b border-line">
                <Eyebrow className="text-[10px]">Année</Eyebrow>
                <Eyebrow className="text-[10px] text-right">VNC ouverture</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Dotation</Eyebrow>
                <Eyebrow className="text-[10px] text-right">Cumul</Eyebrow>
                <Eyebrow className="text-[10px] text-right">VNC clôture</Eyebrow>
              </div>
              {scheduleAsset.schedule.map(row => (
                <div key={row.year} className="grid grid-cols-[0.8fr_1.2fr_1fr_1fr_1.2fr] px-1 py-2.5 border-b border-line last:border-0">
                  <div className="roy-num text-[12.5px] font-semibold text-ink">{row.year}</div>
                  <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtEUR(row.opening_value)}</div>
                  <div className="text-right roy-num text-[12.5px] font-semibold text-ink">{fmtEUR(row.annual_charge)}</div>
                  <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtEUR(row.accumulated)}</div>
                  <div className="text-right roy-num text-[12.5px] text-ink-muted">{fmtEUR(row.closing_value)}</div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end bg-surface-2">
              <OutlineButton onClick={() => setScheduleAsset(null)}>
                Fermer
              </OutlineButton>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {isModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowCreate(false); setEditing(null); }}>
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink">
                {isEdit ? 'Modifier l\'immobilisation' : 'Nouvelle immobilisation'}
              </h2>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[64vh] space-y-4">
              <div>
                <label className={labelClass}>Désignation *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                  placeholder="Ex : Moog Sub 37"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Catégorie</label>
                  <select
                    value={formData.category || 'studio_gear'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className={inputClass}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Compte PCG</label>
                  <select
                    value={formData.pcg_account || '215400'}
                    onChange={e => setFormData({ ...formData, pcg_account: e.target.value })}
                    className={inputClass}
                  >
                    {Object.entries(PCG_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date d&apos;acquisition *</label>
                  <input
                    type="date"
                    value={formData.purchase_date || ''}
                    onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Valeur HT (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_amount_ht ?? 0}
                    onChange={e => setFormData({ ...formData, purchase_amount_ht: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>TVA (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vat_rate ?? 20}
                    onChange={e => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Durée (mois)</label>
                  <input
                    type="number"
                    value={formData.useful_life_months ?? 96}
                    onChange={e => setFormData({ ...formData, useful_life_months: parseInt(e.target.value, 10) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Mode</label>
                  <select
                    value={formData.depreciation_method || 'linear'}
                    onChange={e => setFormData({ ...formData, depreciation_method: e.target.value })}
                    className={inputClass}
                  >
                    <option value="linear">Linéaire</option>
                    <option value="degressive">Dégressif</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>N° interne</label>
                  <input
                    type="text"
                    value={formData.internal_ref || ''}
                    onChange={e => setFormData({ ...formData, internal_ref: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>N° série</label>
                  <input
                    type="text"
                    value={formData.serial_number || ''}
                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Fournisseur</label>
                  <input
                    type="text"
                    value={formData.supplier || ''}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Référence facture</label>
                  <input
                    type="text"
                    value={formData.invoice_reference || ''}
                    onChange={e => setFormData({ ...formData, invoice_reference: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Localisation</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className={inputClass}
                  placeholder="Ex : Studio principal — Rack A"
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
              <OutlineButton onClick={() => { setShowCreate(false); setEditing(null); }}>
                Annuler
              </OutlineButton>
              <AccentButton
                onClick={isEdit ? handleUpdate : handleCreate}
                disabled={saving || !formData.name || !formData.purchase_date}
              >
                {saving && <Spinner size="sm" color="white" />}
                {saving ? 'Enregistrement...' : (isEdit ? 'Enregistrer' : 'Créer')}
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowImport(false)}>
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink">Importer une gear collection Reverb</h2>
              <p className="text-[12.5px] text-ink-faint mt-0.5">
                Reverb → Settings → Gear Collection → Export CSV.
                Le champ <code className="font-mono text-ink-muted">owner_cost</code> est utilisé comme valeur HT.
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Fichier CSV</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-[13px] text-ink-muted file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-ink hover:file:bg-track"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Date d&apos;acquisition par défaut (si l&apos;année n&apos;est pas reconnue)
                </label>
                <input
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
              <OutlineButton onClick={() => setShowImport(false)}>
                Annuler
              </OutlineButton>
              <AccentButton onClick={handleImport} disabled={importing || !importFile}>
                {importing && <Spinner size="sm" color="white" />}
                {importing ? 'Import...' : 'Importer'}
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
