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
  updateAsset,
} from '@/lib/api';

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

export default function AssetsTab() {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    if (!confirm('Supprimer cette immobilisation ?')) return;
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
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => { setShowImport(true); setImportFile(null); }}
          className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors flex items-center gap-2 text-sm"
        >
          Import Reverb CSV
        </button>
        <button
          onClick={() => { setFormData(emptyAsset); setShowCreate(true); }}
          className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
        >
          + Nouvelle immobilisation
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-4 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 underline shrink-0">Fermer</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-success/10 border border-success/30 text-success rounded-xl p-4 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-4 underline shrink-0">Fermer</button>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-default-50 rounded-2xl p-4 border border-divider">
              <p className="text-xs text-secondary-500 uppercase tracking-wide">Immobilisations</p>
              <p className="text-2xl font-bold text-foreground mt-1">{summary.total_count}</p>
            </div>
            <div className="bg-default-50 rounded-2xl p-4 border border-divider">
              <p className="text-xs text-secondary-500 uppercase tracking-wide">Valeur brute</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtEUR(summary.total_gross_value)}</p>
            </div>
            <div className="bg-default-50 rounded-2xl p-4 border border-divider">
              <p className="text-xs text-secondary-500 uppercase tracking-wide">VNC actuelle</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtEUR(summary.total_net_book_value)}</p>
            </div>
            <div className="bg-default-50 rounded-2xl p-4 border border-divider">
              <p className="text-xs text-secondary-500 uppercase tracking-wide">Dotation {new Date().getFullYear()}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{fmtEUR(summary.current_year_charge)}</p>
            </div>
          </div>

          {Object.keys(summary.by_pcg_account).length > 0 && (
            <div className="bg-default-50 rounded-2xl p-4 border border-divider">
              <p className="text-xs text-secondary-500 uppercase tracking-wide mb-3">Répartition par compte PCG</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.by_pcg_account)
                  .sort(([, a], [, b]) => b - a)
                  .map(([acc, gross]) => (
                    <span
                      key={acc}
                      className="px-3 py-1.5 rounded-xl text-sm font-medium bg-default-100 text-foreground border border-divider"
                    >
                      {PCG_LABELS[acc] || acc} · {fmtEUR(gross)}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          {fetching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-secondary-400">…</span>
          )}
          <input
            type="text"
            placeholder="Rechercher une immobilisation..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
        >
          <option value="">Toutes catégories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {assets.length === 0 ? (
        <div className="text-center py-16 bg-default-50 rounded-2xl border border-divider">
          <p className="text-secondary-500">Aucune immobilisation</p>
          <button
            onClick={() => { setFormData(emptyAsset); setShowCreate(true); }}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Ajouter une immobilisation
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left">
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Désignation</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Compte</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Acquis le</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide text-right">Valeur HT</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Durée</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide text-right">VNC</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide text-right">Dotation {new Date().getFullYear()}</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="border-b border-divider/50 hover:bg-default-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image_url} alt={a.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-default-100" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{a.name}</p>
                        <p className="text-xs text-secondary-500">
                          {CATEGORY_LABELS[a.category] || a.category}
                          {a.supplier ? ` · ${a.supplier}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-secondary-600">{a.pcg_account}</td>
                  <td className="py-3 pr-4 text-foreground">{a.purchase_date}</td>
                  <td className="py-3 pr-4 text-right text-foreground">{fmtEUR(Number(a.purchase_amount_ht))}</td>
                  <td className="py-3 pr-4 text-xs text-secondary-600">
                    {a.useful_life_months} mois · {METHOD_LABELS[a.depreciation_method] || a.depreciation_method}
                  </td>
                  <td className="py-3 pr-4 text-right text-foreground font-medium">{fmtEUR(a.net_book_value)}</td>
                  <td className="py-3 pr-4 text-right text-secondary-600">{fmtEUR(a.annual_charge_current_year)}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setScheduleAsset(a)}
                        className="p-1.5 rounded-lg hover:bg-default-100 text-secondary-500 hover:text-foreground transition-colors"
                        title="Voir le plan d'amortissement"
                      >
                        📊
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg hover:bg-default-100 text-secondary-500 hover:text-foreground transition-colors"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deleting === a.id}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-secondary-500 hover:text-danger transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setScheduleAsset(null)}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">{scheduleAsset.name}</h2>
              <p className="text-sm text-secondary-500 mt-1">
                Plan d'amortissement {METHOD_LABELS[scheduleAsset.depreciation_method] || scheduleAsset.depreciation_method.toLowerCase()} sur {scheduleAsset.useful_life_months} mois
              </p>
            </div>
            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider text-left">
                    <th className="pb-2 font-semibold text-secondary-500 text-xs uppercase">Année</th>
                    <th className="pb-2 font-semibold text-secondary-500 text-xs uppercase text-right">VNC ouverture</th>
                    <th className="pb-2 font-semibold text-secondary-500 text-xs uppercase text-right">Dotation</th>
                    <th className="pb-2 font-semibold text-secondary-500 text-xs uppercase text-right">Cumul</th>
                    <th className="pb-2 font-semibold text-secondary-500 text-xs uppercase text-right">VNC clôture</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleAsset.schedule.map(row => (
                    <tr key={row.year} className="border-b border-divider/30">
                      <td className="py-2 font-medium">{row.year}</td>
                      <td className="py-2 text-right">{fmtEUR(row.opening_value)}</td>
                      <td className="py-2 text-right text-foreground font-medium">{fmtEUR(row.annual_charge)}</td>
                      <td className="py-2 text-right text-secondary-600">{fmtEUR(row.accumulated)}</td>
                      <td className="py-2 text-right">{fmtEUR(row.closing_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-divider flex justify-end">
              <button onClick={() => setScheduleAsset(null)} className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors text-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {isModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); setEditing(null); }}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">
                {isEdit ? 'Modifier l\'immobilisation' : 'Nouvelle immobilisation'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Désignation *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  placeholder="Ex : Moog Sub 37"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Catégorie</label>
                  <select
                    value={formData.category || 'studio_gear'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Compte PCG</label>
                  <select
                    value={formData.pcg_account || '215400'}
                    onChange={e => setFormData({ ...formData, pcg_account: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    {Object.entries(PCG_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Date d'acquisition *</label>
                  <input
                    type="date"
                    value={formData.purchase_date || ''}
                    onChange={e => setFormData({ ...formData, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Valeur HT (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_amount_ht ?? 0}
                    onChange={e => setFormData({ ...formData, purchase_amount_ht: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">TVA (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vat_rate ?? 20}
                    onChange={e => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Durée (mois)</label>
                  <input
                    type="number"
                    value={formData.useful_life_months ?? 96}
                    onChange={e => setFormData({ ...formData, useful_life_months: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Mode</label>
                  <select
                    value={formData.depreciation_method || 'linear'}
                    onChange={e => setFormData({ ...formData, depreciation_method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    <option value="linear">Linéaire</option>
                    <option value="degressive">Dégressif</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">N° interne</label>
                  <input
                    type="text"
                    value={formData.internal_ref || ''}
                    onChange={e => setFormData({ ...formData, internal_ref: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">N° série</label>
                  <input
                    type="text"
                    value={formData.serial_number || ''}
                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Fournisseur</label>
                  <input
                    type="text"
                    value={formData.supplier || ''}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Référence facture</label>
                  <input
                    type="text"
                    value={formData.invoice_reference || ''}
                    onChange={e => setFormData({ ...formData, invoice_reference: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Localisation</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  placeholder="Ex : Studio principal — Rack A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                />
              </div>
            </div>
            <div className="p-6 border-t border-divider flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setEditing(null); }}
                className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={isEdit ? handleUpdate : handleCreate}
                disabled={saving || !formData.name || !formData.purchase_date}
                className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (isEdit ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">Importer une gear collection Reverb</h2>
              <p className="text-sm text-secondary-500 mt-1">
                Reverb → Settings → Gear Collection → Export CSV.
                Le champ <code>owner_cost</code> est utilisé comme valeur HT.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Fichier CSV</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">
                  Date d'acquisition par défaut (si l'année n'est pas reconnue)
                </label>
                <input
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                />
              </div>
            </div>
            <div className="p-6 border-t border-divider flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors text-sm">
                Annuler
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importFile}
                className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
              >
                {importing ? 'Import...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
