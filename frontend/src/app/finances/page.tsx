'use client';

import { useState, useEffect, useRef } from 'react';
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
  getArtists,
  getArtistReleases,
  getArtistTracks,
  getExportTransactionsCsvUrl,
  getExportExpensesCsvUrl,
  getExportCsvUrl,
  downloadExport,
  ExpenseEntry,
  RoyaltyPayment,
  FinancesSummary,
  Artist,
  CatalogRelease,
  CatalogTrack,
} from '@/lib/api';
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
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<string>('expenses');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

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
      const [expensesData, paymentsData, summaryData] = await Promise.all([
        getExpenses({ year: parseInt(selectedYear) }),
        getRoyaltyPayments(parseInt(selectedYear)),
        getFinancesSummary(parseInt(selectedYear)),
      ]);
      setExpenses(expensesData);
      setRoyaltyPayments(paymentsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Finances</h1>
              <p className="text-secondary-500 text-sm mt-0.5">Gestion des depenses et royalties</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary transition-colors"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={() => setIsInvoiceImportOpen(true)}
                className="px-4 py-2.5 bg-content2 text-foreground font-medium text-sm rounded-full hover:bg-content3 transition-colors"
              >
                Importer Factures
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-2xl p-4">
            <p className="text-danger">{error}</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-background border border-divider rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm text-secondary-500">Avances / Frais</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-secondary-400 mt-1">{summary?.expenses_count || 0} entrees</p>
          </div>
          <div className="bg-background border border-divider rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-secondary-500">Royalties dues</p>
            </div>
            <p className="text-2xl font-bold text-secondary">{formatCurrency(totalRoyalties)}</p>
            <p className="text-xs text-secondary-400 mt-1">{summary?.royalty_runs_count || 0} periodes</p>
          </div>
          <div className="bg-background border border-divider rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <p className="text-sm text-secondary-500">Total Sorties</p>
            </div>
            <p className="text-2xl font-bold text-danger">{formatCurrency(totalExpenses + totalRoyalties)}</p>
          </div>
          <div className="bg-background border border-divider rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-secondary-500">Derniere maj</p>
            </div>
            <p className="text-lg font-bold text-foreground">{new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${
              activeTab === 'expenses'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-content2 text-secondary-600 hover:bg-content3'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Avances / Frais ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('royalties')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${
              activeTab === 'royalties'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-content2 text-secondary-600 hover:bg-content3'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Royalties ({royaltyPayments.length})
          </button>
          <button
            onClick={() => setActiveTab('exports')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${
              activeTab === 'exports'
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-content2 text-secondary-600 hover:bg-content3'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exports CSV
          </button>
        </div>

        {/* Expenses List */}
        {activeTab === 'expenses' && (
          <>
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Artiste</label>
                <select
                  value={selectedArtistFilter}
                  onChange={(e) => setSelectedArtistFilter(e.target.value)}
                  className="h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors min-w-[200px]"
                >
                  <option value="all">Tous les artistes</option>
                  {artists.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                  <option value="general">Frais généraux</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categorie</label>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors min-w-[200px]"
                >
                  <option value="all">Toutes les categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Avances et Frais</h2>
                <p className="text-sm text-secondary-500">
                  {filteredExpenses.length} depense{filteredExpenses.length > 1 ? 's' : ''}
                  {' · '}
                  {formatCurrency(filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0))}
                </p>
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="p-12 text-center text-secondary-500">
                  Aucune depense trouvee
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {Object.entries(expensesByArtist).map(([artistId, group]) => (
                    <div key={artistId} className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">{group.artist_name}</h3>
                        <p className="font-bold text-warning">{formatCurrency(group.total)}</p>
                      </div>
                      <div className="space-y-3">
                        {group.expenses.map((expense) => (
                          <div key={expense.id} className="p-4 bg-content2 rounded-xl hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-foreground text-lg">
                                    {formatCurrency(expense.amount)}
                                  </p>
                                  {expense.category_label && (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                      {expense.category_label}
                                    </span>
                                  )}
                                  {expense.document_url && (
                                    <button
                                      onClick={() => openDocument(expense.document_url!)}
                                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                                    >
                                      PDF
                                    </button>
                                  )}
                                </div>
                                {(expense.scope && expense.scope !== 'catalog') && (
                                  <p className="text-sm text-secondary-600 mt-2">
                                    {expense.scope === 'track' ? 'Track' : 'Album'} : {' '}
                                    <span className="font-medium">
                                      {expense.scope_title || (expense.scope_id ? expense.scope_id : 'Non specifie')}
                                    </span>
                                  </p>
                                )}
                                {expense.scope === 'catalog' && (
                                  <p className="text-sm text-secondary-500 mt-2">Catalogue general</p>
                                )}
                                {expense.description && (
                                  <p className="text-sm text-secondary-500 mt-1 truncate">
                                    {expense.description}
                                  </p>
                                )}
                                <p className="text-xs text-secondary-400 mt-2">
                                  <span className="font-medium text-secondary-500">
                                    {expense.entry_type === 'advance' ? '⏱ Récup. à partir du ' : ''}
                                  </span>
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
                                    className="px-3 py-1.5 bg-content3 text-secondary-600 text-xs font-medium rounded-full hover:bg-default-200 disabled:opacity-50 transition-colors"
                                  >
                                    {uploadingId === expense.id ? <Spinner size="sm" /> : '+ PDF'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteDocument(expense.id)}
                                    className="px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-full hover:bg-danger/20 transition-colors"
                                  >
                                    Suppr PDF
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal(expense)}
                                  className="px-3 py-1.5 bg-content3 text-secondary-600 text-xs font-medium rounded-full hover:bg-default-200 transition-colors"
                                >
                                  Modifier
                                </button>
                                {deleteConfirmId === expense.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleDelete(expense.id)}
                                      className="px-3 py-1.5 bg-danger text-white text-xs font-medium rounded-full hover:bg-danger-600 transition-colors"
                                    >
                                      Confirmer
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="px-3 py-1.5 bg-content3 text-secondary-600 text-xs font-medium rounded-full hover:bg-default-200 transition-colors"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirmId(expense.id)}
                                    className="px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-full hover:bg-danger/20 transition-colors"
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
            </div>
          </>
        )}

        {/* Royalty Payments List */}
        {activeTab === 'royalties' && (
          <div className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-divider">
              <h2 className="font-semibold text-foreground">Royalties (periodes verrouillees)</h2>
            </div>
            {royaltyPayments.length === 0 ? (
              <div className="p-12 text-center text-secondary-500">
                Aucune royalty verrouillee pour {selectedYear}
              </div>
            ) : (
              <div className="divide-y divide-divider">
                {royaltyPayments.map((payment) => (
                  <div key={payment.run_id} className="p-5 hover:bg-content2 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {formatDate(payment.period_start)} - {formatDate(payment.period_end)}
                        </p>
                        <p className="text-sm text-secondary-500 mt-1">
                          Royalties artistes: {formatCurrency(payment.total_artist_royalties)}
                          {' | '}
                          Recoup: {formatCurrency(payment.total_recouped)}
                        </p>
                        {payment.locked_at && (
                          <p className="text-xs text-secondary-400 mt-1">
                            Verrouille le {formatDate(payment.locked_at)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-secondary">
                          {formatCurrency(payment.total_net_payable)}
                        </p>
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                          {payment.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exports CSV */}
        {activeTab === 'exports' && (
          <div className="space-y-6">
            {/* Transactions export */}
            <div className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-divider flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Ventes / Transactions</h2>
                  <p className="text-xs text-secondary-500 mt-0.5">Toutes les transactions normalisees de toutes les sources</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Artiste</label>
                    <select
                      value={exportTxArtist}
                      onChange={(e) => setExportTxArtist(e.target.value)}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Tous les artistes</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Source</label>
                    <select
                      value={exportTxSource}
                      onChange={(e) => setExportTxSource(e.target.value)}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Toutes les sources</option>
                      {TX_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Annee</label>
                    <select
                      value={exportTxYear}
                      onChange={(e) => { setExportTxYear(e.target.value); setExportTxQuarter(''); }}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Toutes les annees</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportTxYear && (
                    <div>
                      <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Trimestre</label>
                      <select
                        value={exportTxQuarter}
                        onChange={(e) => setExportTxQuarter(e.target.value)}
                        className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="">Toute l'annee</option>
                        <option value="1">T1 (Jan–Mar)</option>
                        <option value="2">T2 (Avr–Jun)</option>
                        <option value="3">T3 (Jul–Sep)</option>
                        <option value="4">T4 (Oct–Dec)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">UPC (optionnel)</label>
                    <input
                      value={exportTxUpc}
                      onChange={(e) => setExportTxUpc(e.target.value)}
                      placeholder="ex: 859735289811"
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleExportTransactions}
                    disabled={exportingTx}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl disabled:opacity-50 transition-all"
                  >
                    {exportingTx ? (
                      <Spinner size="sm" color="white" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    Telecharger CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Expenses export */}
            <div className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-divider flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Avances &amp; Depenses</h2>
                  <p className="text-xs text-secondary-500 mt-0.5">Toutes les avances et frais enregistres</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Artiste</label>
                    <select
                      value={exportExpArtist}
                      onChange={(e) => setExportExpArtist(e.target.value)}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Tous les artistes</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Categorie</label>
                    <select
                      value={exportExpCategory}
                      onChange={(e) => setExportExpCategory(e.target.value)}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Toutes les categories</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Annee</label>
                    <select
                      value={exportExpYear}
                      onChange={(e) => { setExportExpYear(e.target.value); setExportExpQuarter(''); }}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Toutes les annees</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportExpYear && (
                    <div>
                      <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Trimestre</label>
                      <select
                        value={exportExpQuarter}
                        onChange={(e) => setExportExpQuarter(e.target.value)}
                        className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                      >
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
                  <button
                    onClick={handleExportExpenses}
                    disabled={exportingExp}
                    className="flex items-center gap-2 px-5 py-2.5 bg-warning text-white font-medium text-sm rounded-full shadow-lg shadow-warning/30 hover:shadow-xl disabled:opacity-50 transition-all"
                  >
                    {exportingExp ? (
                      <Spinner size="sm" color="white" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    Telecharger CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Royalties export */}
            <div className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-divider flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Rapport de Royalties</h2>
                  <p className="text-xs text-secondary-500 mt-0.5">Calcul des royalties par artiste et par release</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Annee *</label>
                    <select
                      value={exportRoyYear}
                      onChange={(e) => { setExportRoyYear(e.target.value); setExportRoyQuarter(''); }}
                      className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">-- Choisir --</option>
                      {years.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {exportRoyYear && (
                    <div>
                      <label className="text-xs font-medium text-secondary-500 mb-1.5 block">Trimestre</label>
                      <select
                        value={exportRoyQuarter}
                        onChange={(e) => setExportRoyQuarter(e.target.value)}
                        className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                      >
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
                  <button
                    onClick={handleExportRoyalties}
                    disabled={exportingRoy || !exportRoyYear}
                    className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white font-medium text-sm rounded-full shadow-lg shadow-secondary/30 hover:shadow-xl disabled:opacity-50 transition-all"
                  >
                    {exportingRoy ? (
                      <Spinner size="sm" color="white" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    Telecharger CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-5 border-b border-divider flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editingExpense ? 'Modifier la depense' : 'Nouvelle depense'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-secondary-400 hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Montant (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categorie</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">-- Choisir --</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Artiste (optionnel)</label>
                <select
                  value={formArtistId}
                  onChange={(e) => setFormArtistId(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">-- Frais generaux --</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Perimetre</label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as 'catalog' | 'track' | 'release')}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="catalog">Catalogue general</option>
                  <option value="track">Track</option>
                  <option value="release">Album</option>
                </select>
              </div>
              {formScope !== 'catalog' && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {formScope === 'track' ? 'Track' : 'Album'}
                    {formArtistId && (loadingScope ? (
                      <span className="ml-2 text-xs text-secondary-400">Chargement…</span>
                    ) : (
                      <span className="ml-2 text-xs text-secondary-400">
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
                        className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors text-sm"
                      />
                      {/* Selected item badge */}
                      {formScopeId && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                          <span className="text-primary text-sm flex-1 truncate">
                            {formScope === 'track'
                              ? (catalogTracks.find(t => t.isrc === formScopeId)?.track_title || formScopeId)
                              : (catalogReleases.find(r => r.upc === formScopeId)?.release_title || formScopeId)}
                          </span>
                          <span className="text-xs text-secondary-400 font-mono shrink-0">{formScopeId}</span>
                          <button type="button" onClick={() => { setFormScopeId(''); setScopeSearch(''); }}
                            className="text-secondary-400 hover:text-danger transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {/* Scrollable list */}
                      {!formScopeId && (
                        <div className="max-h-44 overflow-y-auto border-2 border-default-200 rounded-xl bg-background divide-y divide-default-100">
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
                                className="w-full text-left px-3 py-2.5 hover:bg-content1 transition-colors"
                              >
                                <p className="text-sm text-foreground font-medium truncate">{label}</p>
                                <p className="text-xs text-secondary-400 font-mono">{id}{sub ? ` · ${sub}` : ''}</p>
                              </button>
                            );
                          })}
                          {(formScope === 'track'
                            ? catalogTracks.filter(t => !scopeSearch || t.track_title.toLowerCase().includes(scopeSearch.toLowerCase())).length === 0
                            : catalogReleases.filter(r => !scopeSearch || r.release_title.toLowerCase().includes(scopeSearch.toLowerCase())).length === 0
                          ) && (
                            <p className="text-sm text-secondary-400 px-3 py-3 text-center">Aucun résultat</p>
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
                      className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                    />
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Reference</label>
                <input
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="N facture, etc."
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Date effective</label>
                <p className="text-xs text-secondary-400 mb-2">Seules les royautés <strong>après cette date</strong> seront imputées sur cette avance.</p>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-divider flex gap-3 bg-content2/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-5 py-2.5 border-2 border-default-300 text-foreground font-medium rounded-full hover:bg-default-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formAmount}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white font-medium rounded-full disabled:opacity-50 shadow-lg shadow-primary/30 transition-all"
              >
                {saving && <Spinner size="sm" color="white" />}
                {editingExpense ? 'Enregistrer' : 'Creer'}
              </button>
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
    </>
  );
}
