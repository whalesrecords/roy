'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadExpenseDocument,
  deleteExpenseDocument,
  getRoyaltyPayments,
  getFinancesSummary,
  getAnalyticsSummary,
  getArtists,
  getArtistReleases,
  getArtistTracks,
  getExportTransactionsCsvUrl,
  getExportExpensesCsvUrl,
  getExportExpensesPdfUrl,
  getExportCsvUrl,
  downloadExport,
  ExpenseEntry,
  RoyaltyPayment,
  FinancesSummary,
  AnalyticsSummary,
  Artist,
  CatalogRelease,
  CatalogTrack,
} from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { Card, Pill, Kpi, AccentButton, OutlineButton } from '@/components/roy/ui';
import {
  IconPlus, IconImport, IconDownload, IconRoyalty, IconChart, IconBox,
} from '@/components/roy/icons';
import InvoiceImportModal from '@/components/InvoiceImportModal';

const EXPENSE_CATEGORIES = [
  { value: 'mastering', label: 'Mastering' },
  { value: 'mixing', label: 'Mixage' },
  { value: 'recording', label: 'Enregistrement' },
  { value: 'photos', label: 'Photos' },
  { value: 'video', label: 'Video' },
  { value: 'advertising', label: 'Publicite' },
  { value: 'groover', label: 'Groover' },
  { value: 'submithub', label: 'SubmitHub' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'spotify_ads', label: 'Spotify Ads' },
  { value: 'pr', label: 'PR / Relations presse' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'cd', label: 'CD' },
  { value: 'vinyl', label: 'Vinyles' },
  { value: 'goodies', label: 'Goodies / Merch' },
  { value: 'other', label: 'Autre' },
];

export default function FinancesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
  const [summary, setSummary] = useState<FinancesSummary | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<string>('expenses');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<string>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceImportOpen, setIsInvoiceImportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formArtistId, setFormArtistId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formScope, setFormScope] = useState<'catalog' | 'track' | 'release'>('catalog');
  const [formScopeId, setFormScopeId] = useState('');

  // Catalog items for scope picker
  const [catalogReleases, setCatalogReleases] = useState<CatalogRelease[]>([]);
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [scopeSearch, setScopeSearch] = useState('');
  const [loadingScope, setLoadingScope] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Export state
  const [exportTxArtist, setExportTxArtist] = useState('');
  const [exportTxUpc, setExportTxUpc] = useState('');
  const [exportTxYear, setExportTxYear] = useState('');
  const [exportTxQuarter, setExportTxQuarter] = useState('');
  const [exportTxSource, setExportTxSource] = useState('');
  const [exportingTx, setExportingTx] = useState(false);
  const [exportExpArtist, setExportExpArtist] = useState('');
  const [exportExpYear, setExportExpYear] = useState('');
  const [exportExpQuarter, setExportExpQuarter] = useState('');
  const [exportExpCategory, setExportExpCategory] = useState('');
  const [exportingExp, setExportingExp] = useState(false);
  const [exportingExpPdf, setExportingExpPdf] = useState(false);
  const [exportRoyYear, setExportRoyYear] = useState('');
  const [exportRoyQuarter, setExportRoyQuarter] = useState('');
  const [exportingRoy, setExportingRoy] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());
  const TX_SOURCES = [
    { value: 'bandcamp', label: 'Bandcamp' },
    { value: 'tunecore', label: 'TuneCore' },
    { value: 'believe_fr', label: 'Believe FR' },
    { value: 'believe_uk', label: 'Believe UK' },
    { value: 'squarespace', label: 'Squarespace' },
    { value: 'detailsdetails', label: 'DetailsDetails' },
  ];

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  useEffect(() => {
    loadArtists();
  }, []);

  // Load catalog items when artist or scope changes in form
  useEffect(() => {
    if (formScope === 'catalog' || !formArtistId) {
      setCatalogReleases([]);
      setCatalogTracks([]);
      return;
    }
    const artistName = artists.find(a => a.id === formArtistId)?.name;
    if (!artistName) return;

    setLoadingScope(true);
    if (formScope === 'release') {
      getArtistReleases(artistName)
        .then(r => setCatalogReleases(r.filter(rel => rel.upc)))
        .catch(() => setCatalogReleases([]))
        .finally(() => setLoadingScope(false));
    } else {
      getArtistTracks(artistName)
        .then(t => setCatalogTracks(t.filter(tr => tr.isrc)))
        .catch(() => setCatalogTracks([]))
        .finally(() => setLoadingScope(false));
    }
  }, [formArtistId, formScope, artists]);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (err) {
      console.error('Error loading artists:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expensesData, paymentsData, summaryData, analyticsData] = await Promise.all([
        getExpenses({ year: parseInt(selectedYear) }),
        getRoyaltyPayments(parseInt(selectedYear)),
        getFinancesSummary(parseInt(selectedYear)),
        getAnalyticsSummary(parseInt(selectedYear)).catch(() => null),
      ]);
      setExpenses(expensesData);
      setRoyaltyPayments(paymentsData);
      setSummary(summaryData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormAmount('');
    setFormCategory('');
    setFormArtistId('');
    setFormDescription('');
    setFormReference('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormScope('catalog');
    setFormScopeId('');
    setScopeSearch('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setFormAmount(expense.amount);
    setFormCategory(expense.category || '');
    setFormArtistId(expense.artist_id || '');
    setFormDescription(expense.description || '');
    setFormReference(expense.reference || '');
    setFormDate(expense.effective_date.split('T')[0]);
    setFormScope(expense.scope as 'catalog' | 'track' | 'release');
    setFormScopeId(expense.scope_id || '');
    setScopeSearch('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formAmount) return;

    setSaving(true);
    try {
      const data = {
        amount: formAmount,
        category: formCategory || undefined,
        artist_id: formArtistId || undefined,
        description: formDescription || undefined,
        reference: formReference || undefined,
        effective_date: formDate,
        scope: formScope,
        scope_id: formScopeId || undefined,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, data);
      } else {
        await createExpense(data);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    }
  };

  const handleFileUpload = async (expenseId: string, file: File) => {
    setUploadingId(expenseId);
    try {
      await uploadExpenseDocument(expenseId, file);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteDocument = async (expenseId: string) => {
    try {
      await deleteExpenseDocument(expenseId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression document');
    }
  };

  const openDocument = (documentUrl: string) => {
    if (documentUrl.startsWith('data:')) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Document PDF</title></head>
            <body style="margin:0;padding:0;">
              <embed src="${documentUrl}" type="application/pdf" width="100%" height="100%" />
            </body>
          </html>
        `);
      }
    } else {
      window.open(documentUrl, '_blank');
    }
  };

  const totalExpenses = summary ? parseFloat(summary.total_expenses) : 0;
  const totalRoyalties = summary ? parseFloat(summary.total_royalties_payable) : 0;

  // ── Derived presentation data (from analytics) ──
  const totalRevenue = analytics ? parseFloat(analytics.total_revenue) : 0;
  const netMargin = analytics ? parseFloat(analytics.net) : 0;
  const marginDisplay = analytics
    ? totalRevenue > 0
      ? `${((netMargin / totalRevenue) * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
      : formatCurrency(netMargin)
    : '—';

  // Expenses by category bars (sorted desc)
  const expensesByCategory = useMemo(() => {
    if (!analytics) return [] as { name: string; value: number }[];
    return analytics.expenses_by_category
      .map((c) => ({ name: c.category_label, value: parseFloat(c.amount) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [analytics]);
  const maxCategoryValue = expensesByCategory.length ? expensesByCategory[0].value : 1;

  // Latest operations: revenues (monthly) + expenses, merged & sorted by date desc
  const recentOperations = useMemo(() => {
    const ops: { key: string; label: string; date: string; amount: number }[] = [];
    if (analytics) {
      analytics.monthly_revenue.forEach((m) => {
        const value = parseFloat(m.gross);
        if (value > 0) {
          ops.push({
            key: `rev-${m.year}-${m.month}`,
            label: `Revenus · ${m.month_label}`,
            date: `${m.year}-${String(m.month).padStart(2, '0')}-01`,
            amount: value,
          });
        }
      });
    }
    expenses.forEach((e) => {
      ops.push({
        key: `exp-${e.id}`,
        label: e.description || e.category_label || e.scope_title || 'Dépense',
        date: e.effective_date,
        amount: -parseFloat(e.amount),
      });
    });
    return ops
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [analytics, expenses]);

  // Collect unique scope titles for the filter dropdown
  const scopeTitles = Array.from(
    new Set(expenses.map((e) => e.scope_title).filter(Boolean) as string[])
  ).sort();

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (selectedArtistFilter !== 'all') {
      if (selectedArtistFilter === 'general' && expense.artist_id !== null) {
        return false;
      }
      if (selectedArtistFilter !== 'general' && expense.artist_id !== selectedArtistFilter) {
        return false;
      }
    }
    if (selectedCategoryFilter !== 'all' && expense.category !== selectedCategoryFilter) {
      return false;
    }
    if (selectedScopeFilter && expense.scope_title !== selectedScopeFilter) {
      return false;
    }
    return true;
  });

  // Group by artist
  const expensesByArtist = filteredExpenses.reduce((acc, expense) => {
    const key = expense.artist_id || 'general';
    if (!acc[key]) {
      acc[key] = {
        artist_name: expense.artist_name || 'Frais généraux',
        expenses: [],
        total: 0,
      };
    }
    acc[key].expenses.push(expense);
    acc[key].total += parseFloat(expense.amount);
    return acc;
  }, {} as Record<string, { artist_name: string; expenses: ExpenseEntry[]; total: number }>);

  const handleExportTransactions = async () => {
    setExportingTx(true);
    try {
      const params = {
        artist_id: exportTxArtist || undefined,
        upc: exportTxUpc || undefined,
        year: exportTxYear ? parseInt(exportTxYear) : undefined,
        quarter: exportTxQuarter ? parseInt(exportTxQuarter) : undefined,
        source: exportTxSource || undefined,
      };
      const url = getExportTransactionsCsvUrl(params);
      const parts = ['transactions'];
      if (exportTxYear) { parts.push(exportTxYear); if (exportTxQuarter) parts.push(`Q${exportTxQuarter}`); }
      if (exportTxSource) parts.push(exportTxSource);
      await downloadExport(url, parts.join('_') + '.csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur export transactions');
    } finally {
      setExportingTx(false);
    }
  };

  const handleExportExpenses = async () => {
    setExportingExp(true);
    try {
      const params = {
        artist_id: exportExpArtist || undefined,
        year: exportExpYear ? parseInt(exportExpYear) : undefined,
        quarter: exportExpQuarter ? parseInt(exportExpQuarter) : undefined,
        category: exportExpCategory || undefined,
      };
      const url = getExportExpensesCsvUrl(params);
      const parts = ['depenses'];
      if (exportExpYear) { parts.push(exportExpYear); if (exportExpQuarter) parts.push(`Q${exportExpQuarter}`); }
      if (exportExpCategory) parts.push(exportExpCategory);
      await downloadExport(url, parts.join('_') + '.csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur export depenses');
    } finally {
      setExportingExp(false);
    }
  };

  const handleExportExpensesPdf = () => {
    const params = {
      artist_id: exportExpArtist || undefined,
      year: exportExpYear ? parseInt(exportExpYear) : undefined,
      quarter: exportExpQuarter ? parseInt(exportExpQuarter) : undefined,
      category: exportExpCategory || undefined,
    };
    const url = getExportExpensesPdfUrl(params);
    window.open(url, '_blank');
  };

  const handleExportRoyalties = async () => {
    if (!exportRoyYear) return;
    setExportingRoy(true);
    try {
      const q = exportRoyQuarter ? parseInt(exportRoyQuarter) : null;
      let periodStart: string;
      let periodEnd: string;
      if (q) {
        const monthStart = (q - 1) * 3 + 1;
        const monthEnd = q * 3;
        periodStart = `${exportRoyYear}-${String(monthStart).padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(exportRoyYear), monthEnd, 0).getDate();
        periodEnd = `${exportRoyYear}-${String(monthEnd).padStart(2, '0')}-${lastDay}`;
      } else {
        periodStart = `${exportRoyYear}-01-01`;
        periodEnd = `${exportRoyYear}-12-31`;
      }
      const url = getExportCsvUrl(periodStart, periodEnd);
      await downloadExport(url, `royalties_${exportRoyYear}${q ? `_Q${q}` : ''}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur export royalties');
    } finally {
      setExportingRoy(false);
    }
  };

  const TABS: { value: string; label: string }[] = [
    { value: 'expenses', label: `Avances / Frais (${expenses.length})` },
    { value: 'royalties', label: `Royalties (${royaltyPayments.length})` },
    { value: 'exports', label: 'Exports CSV' },
  ];

  const inputClass =
    'w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

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
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Finances</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Whales Records · dépenses et royalties {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
            {years.slice(0, 4).map((y) => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-[7px] text-[12px] font-${y === selectedYear ? 'semibold' : 'medium'} min-h-[44px] ${y === selectedYear ? 'bg-ink text-app' : 'text-ink-muted hover:text-ink'}`}>
                {y}
              </button>
            ))}
          </div>
          <OutlineButton onClick={() => setIsInvoiceImportOpen(true)}>
            <IconImport size={14} /> Importer factures
          </OutlineButton>
          <AccentButton onClick={openCreateModal}>
            <IconPlus size={14} /> Nouvelle dépense
          </AccentButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && !isModalOpen && (
          <div role="alert" aria-live="assertive" className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
          <Kpi label="Revenus" value={analytics ? formatCurrency(totalRevenue) : '—'} />
          <Kpi label="Dépenses" value={formatCurrency(totalExpenses)} hint={`${summary?.expenses_count || 0} entrées`} />
          <Kpi
            label="Marge nette"
            value={marginDisplay}
            hero
            accentValue
            hint={analytics ? `${formatCurrency(netMargin)} · après royalties` : undefined}
            hintTone="accent"
          />
        </div>

        {/* Two-column row: categories + operations */}
        <div className="grid md:grid-cols-2 gap-3.5">
          {/* Dépenses par catégorie */}
          <Card>
            <span className="text-[13.5px] font-semibold text-ink">Dépenses par catégorie</span>
            {expensesByCategory.length > 0 ? (
              <div className="flex flex-col gap-3 mt-4">
                {expensesByCategory.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[12.5px] text-ink">{c.name}</span>
                      <span className="roy-num text-[12.5px] font-semibold text-ink">{formatCurrency(c.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-track overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${(c.value / maxCategoryValue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-faint text-[13px] py-6 text-center">Aucune dépense pour {selectedYear}</p>
            )}
          </Card>

          {/* Dernières opérations */}
          <Card>
            <span className="text-[13.5px] font-semibold text-ink">Dernières opérations</span>
            {recentOperations.length > 0 ? (
              <div className="flex flex-col mt-2">
                {recentOperations.map((op, i) => (
                  <div
                    key={op.key}
                    className={`flex items-center justify-between py-2.5 ${i < recentOperations.length - 1 ? 'border-b border-line' : ''}`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[13px] font-semibold text-ink truncate">{op.label}</div>
                      <div className="text-[11px] text-ink-faint mt-0.5">{formatDate(op.date)}</div>
                    </div>
                    <span className={`roy-num text-[13px] font-bold shrink-0 ${op.amount >= 0 ? 'text-accent' : 'text-ink-muted'}`}>
                      {op.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(op.amount))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-faint text-[13px] py-6 text-center">Aucune opération</p>
            )}
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] font-${activeTab === t.value ? 'semibold' : 'medium'} transition-colors ${activeTab === t.value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Expenses List */}
        {activeTab === 'expenses' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className={labelClass}>Artiste</label>
                <select
                  value={selectedArtistFilter}
                  onChange={(e) => setSelectedArtistFilter(e.target.value)}
                  className={`${inputClass} min-w-[200px]`}
                >
                  <option value="all">Tous les artistes</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                  <option value="general">Frais généraux</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Catégorie</label>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className={`${inputClass} min-w-[200px]`}
                >
                  <option value="all">Toutes les categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {scopeTitles.length > 0 && (
                <div>
                  <label className={labelClass}>Album / Track</label>
                  <select
                    value={selectedScopeFilter}
                    onChange={(e) => setSelectedScopeFilter(e.target.value)}
                    className={`${inputClass} min-w-[200px]`}
                  >
                    <option value="">Tous</option>
                    {scopeTitles.map((title) => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <Card padded={false} className="overflow-hidden">
              <div className="px-[22px] py-4 border-b border-line flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-ink">Avances et frais</span>
                <span className="text-[12px] text-ink-faint">
                  {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
                  {' · '}
                  <span className="roy-num">{formatCurrency(filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0))}</span>
                </span>
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="p-12 text-center text-ink-faint text-[13px]">
                  Aucune dépense trouvée
                </div>
              ) : (
                <div>
                  {Object.entries(expensesByArtist).map(([artistId, group]) => (
                    <div key={artistId} className="px-[22px] py-5 border-b border-line last:border-0">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[13.5px] font-semibold text-ink">{group.artist_name}</h3>
                        <p className="roy-num font-bold text-ink">{formatCurrency(group.total)}</p>
                      </div>
                      <div className="space-y-2.5">
                        {group.expenses.map((expense) => (
                          <div key={expense.id} className="p-4 bg-surface-2 rounded-[12px]">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="roy-num font-bold text-ink text-[17px]">
                                    {formatCurrency(expense.amount)}
                                  </p>
                                  {expense.category_label && (
                                    <Pill tone="accent">{expense.category_label}</Pill>
                                  )}
                                  {expense.document_url && (
                                    <button
                                      onClick={() => openDocument(expense.document_url!)}
                                      className="inline-flex items-center rounded-full bg-surface px-2.5 py-[3px] text-[10.5px] font-semibold text-ink-muted border border-line hover:border-line-strong transition-colors"
                                    >
                                      PDF
                                    </button>
                                  )}
                                </div>
                                {(expense.scope && expense.scope !== 'catalog') && (
                                  <p className="text-[12.5px] text-ink-muted mt-2">
                                    {expense.scope === 'track' ? 'Track' : 'Album'} : {' '}
                                    <span className="font-medium text-ink">
                                      {expense.scope_title || (expense.scope_id ? expense.scope_id : 'Non specifie')}
                                    </span>
                                  </p>
                                )}
                                {expense.scope === 'catalog' && (
                                  <p className="text-[12.5px] text-ink-faint mt-2">Catalogue général</p>
                                )}
                                {expense.description && (
                                  <p className="text-[12.5px] text-ink-faint mt-1 truncate">
                                    {expense.description}
                                  </p>
                                )}
                                <p className="text-[11px] text-ink-faint mt-2">
                                  {expense.entry_type === 'advance' ? 'Récup. à partir du ' : ''}
                                  {formatDate(expense.effective_date)}
                                  {expense.reference && ` · Ref: ${expense.reference}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  ref={fileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file && uploadingId) {
                                      handleFileUpload(uploadingId, file);
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                {!expense.document_url ? (
                                  <button
                                    onClick={() => {
                                      setUploadingId(expense.id);
                                      fileInputRef.current?.click();
                                    }}
                                    disabled={uploadingId === expense.id}
                                    className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-50 transition-colors"
                                  >
                                    {uploadingId === expense.id ? <Spinner size="sm" /> : '+ PDF'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteDocument(expense.id)}
                                    className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-neg hover:border-line-strong transition-colors"
                                  >
                                    Suppr PDF
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal(expense)}
                                  className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted hover:text-ink hover:border-line-strong transition-colors"
                                >
                                  Modifier
                                </button>
                                {deleteConfirmId === expense.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleDelete(expense.id)}
                                      className="inline-flex items-center rounded-[8px] bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-ink hover:opacity-90 transition-opacity"
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted hover:text-ink hover:border-line-strong transition-colors"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmId(expense.id)}
                                    className="inline-flex items-center rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-neg hover:border-line-strong transition-colors"
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Royalty Payments List */}
        {activeTab === 'royalties' && (
          <Card padded={false} className="overflow-hidden">
            <div className="px-[22px] py-4 border-b border-line">
              <span className="text-[13.5px] font-semibold text-ink">Royalties (périodes verrouillées)</span>
            </div>
            {royaltyPayments.length === 0 ? (
              <div className="p-12 text-center text-ink-faint text-[13px]">
                Aucune royalty verrouillée pour {selectedYear}
              </div>
            ) : (
              <div>
                {royaltyPayments.map((payment) => (
                  <div key={payment.run_id} className="px-[22px] py-5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13.5px] font-semibold text-ink">
                          {formatDate(payment.period_start)} - {formatDate(payment.period_end)}
                        </p>
                        <p className="text-[12.5px] text-ink-muted mt-1">
                          Royalties artistes: <span className="roy-num">{formatCurrency(payment.total_artist_royalties)}</span>
                          {' | '}
                          Recoup: <span className="roy-num">{formatCurrency(payment.total_recouped)}</span>
                        </p>
                        {payment.locked_at && (
                          <p className="text-[11px] text-ink-faint mt-1">
                            Verrouillé le {formatDate(payment.locked_at)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="roy-num text-[22px] font-bold text-ink">
                          {formatCurrency(payment.total_net_payable)}
                        </p>
                        <span className="inline-block mt-2"><Pill tone="accent">{payment.status}</Pill></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Exports CSV */}
        {activeTab === 'exports' && (
          <div className="space-y-4">
            {/* Transactions export */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-[22px] py-4 border-b border-line flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconChart size={18} />
                </div>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-ink">Ventes / Transactions</h2>
                  <p className="text-[11.5px] text-ink-faint mt-0.5">Toutes les transactions normalisées de toutes les sources</p>
                </div>
              </div>
              <div className="p-[22px] space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Artiste</label>
                    <select value={exportTxArtist} onChange={(e) => setExportTxArtist(e.target.value)} className={inputClass}>
                      <option value="">Tous les artistes</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Source</label>
                    <select value={exportTxSource} onChange={(e) => setExportTxSource(e.target.value)} className={inputClass}>
                      <option value="">Toutes les sources</option>
                      {TX_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Année</label>
                    <select value={exportTxYear} onChange={(e) => { setExportTxYear(e.target.value); setExportTxQuarter(''); }} className={inputClass}>
                      <option value="">Toutes les annees</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportTxYear && (
                    <div>
                      <label className={labelClass}>Trimestre</label>
                      <select value={exportTxQuarter} onChange={(e) => setExportTxQuarter(e.target.value)} className={inputClass}>
                        <option value="">Toute l'annee</option>
                        <option value="1">T1 (Jan–Mar)</option>
                        <option value="2">T2 (Avr–Jun)</option>
                        <option value="3">T3 (Jul–Sep)</option>
                        <option value="4">T4 (Oct–Dec)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>UPC (optionnel)</label>
                    <input value={exportTxUpc} onChange={(e) => setExportTxUpc(e.target.value)} placeholder="ex: 859735289811" className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <AccentButton onClick={handleExportTransactions} disabled={exportingTx}>
                    {exportingTx ? <Spinner size="sm" color="white" /> : <IconDownload size={14} />}
                    Télécharger CSV
                  </AccentButton>
                </div>
              </div>
            </Card>

            {/* Expenses export */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-[22px] py-4 border-b border-line flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconBox size={18} />
                </div>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-ink">Avances &amp; Dépenses</h2>
                  <p className="text-[11.5px] text-ink-faint mt-0.5">Toutes les avances et frais enregistrés</p>
                </div>
              </div>
              <div className="p-[22px] space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Artiste</label>
                    <select value={exportExpArtist} onChange={(e) => setExportExpArtist(e.target.value)} className={inputClass}>
                      <option value="">Tous les artistes</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Catégorie</label>
                    <select value={exportExpCategory} onChange={(e) => setExportExpCategory(e.target.value)} className={inputClass}>
                      <option value="">Toutes les categories</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Année</label>
                    <select value={exportExpYear} onChange={(e) => { setExportExpYear(e.target.value); setExportExpQuarter(''); }} className={inputClass}>
                      <option value="">Toutes les annees</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportExpYear && (
                    <div>
                      <label className={labelClass}>Trimestre</label>
                      <select value={exportExpQuarter} onChange={(e) => setExportExpQuarter(e.target.value)} className={inputClass}>
                        <option value="">Toute l'annee</option>
                        <option value="1">T1 (Jan–Mar)</option>
                        <option value="2">T2 (Avr–Jun)</option>
                        <option value="3">T3 (Jul–Sep)</option>
                        <option value="4">T4 (Oct–Dec)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <OutlineButton onClick={handleExportExpensesPdf}>
                    {exportingExpPdf ? <Spinner size="sm" /> : <IconDownload size={14} />}
                    Télécharger PDF
                  </OutlineButton>
                  <AccentButton onClick={handleExportExpenses} disabled={exportingExp}>
                    {exportingExp ? <Spinner size="sm" color="white" /> : <IconDownload size={14} />}
                    Télécharger CSV
                  </AccentButton>
                </div>
              </div>
            </Card>

            {/* Royalties export */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-[22px] py-4 border-b border-line flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
                  <IconRoyalty size={18} />
                </div>
                <div>
                  <h2 className="text-[13.5px] font-semibold text-ink">Rapport de Royalties</h2>
                  <p className="text-[11.5px] text-ink-faint mt-0.5">Calcul des royalties par artiste et par release</p>
                </div>
              </div>
              <div className="p-[22px] space-y-4">
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className={labelClass}>Année *</label>
                    <select value={exportRoyYear} onChange={(e) => { setExportRoyYear(e.target.value); setExportRoyQuarter(''); }} className={inputClass}>
                      <option value="">-- Choisir --</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportRoyYear && (
                    <div>
                      <label className={labelClass}>Trimestre</label>
                      <select value={exportRoyQuarter} onChange={(e) => setExportRoyQuarter(e.target.value)} className={inputClass}>
                        <option value="">Toute l'annee</option>
                        <option value="1">T1 (Jan–Mar)</option>
                        <option value="2">T2 (Avr–Jun)</option>
                        <option value="3">T3 (Jul–Sep)</option>
                        <option value="4">T4 (Oct–Dec)</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <AccentButton onClick={handleExportRoyalties} disabled={exportingRoy || !exportRoyYear}>
                    {exportingRoy ? <Spinner size="sm" color="white" /> : <IconDownload size={14} />}
                    Télécharger CSV
                  </AccentButton>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">
                {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-4">
              <div>
                <label className={labelClass}>Montant (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Catégorie</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                >
                  <option value="">-- Choisir --</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Artiste (optionnel)</label>
                <select
                  value={formArtistId}
                  onChange={(e) => setFormArtistId(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                >
                  <option value="">-- Frais generaux --</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Périmètre</label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as 'catalog' | 'track' | 'release')}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                >
                  <option value="catalog">Catalogue general</option>
                  <option value="track">Track</option>
                  <option value="release">Album</option>
                </select>
              </div>
              {formScope !== 'catalog' && (
                <div>
                  <label className={`${labelClass} flex items-center`}>
                    {formScope === 'track' ? 'Track' : 'Album'}
                    {formArtistId && (loadingScope ? (
                      <span className="ml-2 normal-case tracking-normal text-[10px] text-ink-faint font-normal">Chargement…</span>
                    ) : (
                      <span className="ml-2 normal-case tracking-normal text-[10px] text-ink-faint font-normal">
                        {formScope === 'track' ? `${catalogTracks.length} track(s)` : `${catalogReleases.length} album(s)`}
                      </span>
                    ))}
                  </label>
                  {/* If we have catalog items, show searchable list */}
                  {formArtistId && (formScope === 'track' ? catalogTracks.length > 0 : catalogReleases.length > 0) ? (
                    <div className="space-y-2">
                      {/* Search input */}
                      <input
                        value={scopeSearch}
                        onChange={(e) => setScopeSearch(e.target.value)}
                        placeholder={`Rechercher un ${formScope === 'track' ? 'titre' : 'album'}…`}
                        className={inputClass}
                      />
                      {/* Selected item badge */}
                      {formScopeId && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-accent-soft border border-accent/30 rounded-[10px]">
                          <span className="text-accent text-[13px] flex-1 truncate">
                            {formScope === 'track'
                              ? (catalogTracks.find(t => t.isrc === formScopeId)?.track_title || formScopeId)
                              : (catalogReleases.find(r => r.upc === formScopeId)?.release_title || formScopeId)}
                          </span>
                          <span className="text-[11px] text-ink-faint font-mono shrink-0">{formScopeId}</span>
                          <button type="button" onClick={() => { setFormScopeId(''); setScopeSearch(''); }}
                            aria-label="Retirer la sélection"
                            className="text-ink-faint hover:text-neg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {/* Scrollable list */}
                      {!formScopeId && (
                        <div className="max-h-44 overflow-y-auto border border-line rounded-[10px] bg-surface divide-y divide-line">
                          {(formScope === 'track'
                            ? catalogTracks.filter(t => !scopeSearch || t.track_title.toLowerCase().includes(scopeSearch.toLowerCase()))
                            : catalogReleases.filter(r => !scopeSearch || r.release_title.toLowerCase().includes(scopeSearch.toLowerCase()))
                          ).map((item) => {
                            const id = formScope === 'track' ? (item as CatalogTrack).isrc : (item as CatalogRelease).upc;
                            const label = formScope === 'track' ? (item as CatalogTrack).track_title : (item as CatalogRelease).release_title;
                            const sub = formScope === 'track' ? (item as CatalogTrack).release_title : '';
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => { setFormScopeId(id!); setScopeSearch(''); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors"
                              >
                                <p className="text-[13px] text-ink font-medium truncate">{label}</p>
                                <p className="text-[11px] text-ink-faint font-mono">{id}{sub ? ` · ${sub}` : ''}</p>
                              </button>
                            );
                          })}
                          {(formScope === 'track'
                            ? catalogTracks.filter(t => !scopeSearch || t.track_title.toLowerCase().includes(scopeSearch.toLowerCase())).length === 0
                            : catalogReleases.filter(r => !scopeSearch || r.release_title.toLowerCase().includes(scopeSearch.toLowerCase())).length === 0
                          ) && (
                            <p className="text-[13px] text-ink-faint px-3 py-3 text-center">Aucun résultat</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Fallback: manual ISRC/UPC input when no catalog available */
                    <input
                      value={formScopeId}
                      onChange={(e) => setFormScopeId(e.target.value)}
                      placeholder={formScope === 'track' ? 'Code ISRC du track' : "Code UPC de l'album"}
                      className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
                    />
                  )}
                </div>
              )}
              <div>
                <label className={labelClass}>Description</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                />
              </div>
              <div>
                <label className={labelClass}>Référence</label>
                <input
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="N facture, etc."
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
                />
              </div>
              <div>
                <label className={labelClass}>Date effective</label>
                <p className="text-[11px] text-ink-faint mb-2">Seules les royautés <strong className="text-ink-muted">après cette date</strong> seront imputées sur cette avance.</p>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line space-y-3 bg-surface-2">
              {error && (
                <div role="alert" aria-live="assertive" className="flex items-start gap-2 px-3.5 py-2.5 rounded-[10px] bg-neg/10 border border-neg/20 text-neg text-[12.5px]">
                  <svg className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              <div className="flex gap-3">
                <OutlineButton onClick={() => setIsModalOpen(false)} className="flex-1 justify-center">
                  Annuler
                </OutlineButton>
                <AccentButton onClick={handleSave} disabled={saving || !formAmount} className="flex-1">
                  {saving && <Spinner size="sm" color="white" />}
                  {editingExpense ? 'Enregistrer' : 'Créer'}
                </AccentButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Import Modal */}
      <InvoiceImportModal
        isOpen={isInvoiceImportOpen}
        onClose={() => setIsInvoiceImportOpen(false)}
        artists={artists}
        onSuccess={loadData}
      />
    </div>
  );
}
