'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Spinner } from '@heroui/react';
import {
  getProducts,
  getInventorySummary,
  autoDiscoverProducts,
  importInventoryCSV,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStockMovements,
  Product,
  InventorySummary,
  StockMovement,
} from '@/lib/api';

const FORMAT_LABELS: Record<string, string> = {
  vinyl: 'Vinyle',
  cd: 'CD',
  cassette: 'K7',
  merch: 'Merch',
  bundle: 'Bundle',
  other: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  sold_out: 'Épuisé',
  preorder: 'Précommande',
  discontinued: 'Arrêté',
};

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  sold_out: 'bg-red-100 text-red-700',
  preorder: 'bg-blue-100 text-blue-700',
  discontinued: 'bg-gray-100 text-gray-700',
};

const FORMAT_ICONS: Record<string, string> = {
  vinyl: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  cd: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  cassette: 'M4 6h16v12H4V6zm2 10h12M8 16v2m8-2v2M7 10h2m6 0h2',
  merch: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  bundle: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  other: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
};

const MOVEMENT_TYPES = [
  { value: 'in', label: 'Entrée' },
  { value: 'out', label: 'Sortie' },
  { value: 'adjustment', label: 'Ajustement' },
  { value: 'return', label: 'Retour' },
];

const MOVEMENT_SOURCES = [
  { value: 'manual', label: 'Manuel' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'squarespace', label: 'Squarespace' },
];

const emptyProduct: Partial<Product> = {
  title: '',
  format: 'vinyl',
  variant: '',
  sku: '',
  release_upc: '',
  artist_name: '',
  price_eur: 0,
  cost_eur: 0,
  stock_quantity: 0,
  low_stock_threshold: 5,
  status: 'available',
  limited_edition: false,
  edition_size: undefined,
  image_url: '',
  notes: '',
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // CSV import state
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvSource, setCsvSource] = useState<'bandcamp' | 'squarespace'>('bandcamp');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>(emptyProduct);
  const [stockForm, setStockForm] = useState({ quantity: 1, movement_type: 'in', reason: '', source: 'manual' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      setError(null);
      const params: { format?: string; status?: string; low_stock?: boolean; search?: string } = {};
      if (formatFilter) params.format = formatFilter;
      if (statusFilter) params.status = statusFilter;
      if (lowStockOnly) params.low_stock = true;
      if (search) params.search = search;

      const [productsData, summaryData] = await Promise.all([
        getProducts(params),
        getInventorySummary(),
      ]);
      setProducts(productsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [formatFilter, statusFilter, lowStockOnly, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await createProduct(formData);
      setShowCreateModal(false);
      setFormData(emptyProduct);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;
    setSaving(true);
    setError(null);
    try {
      await updateProduct(editingProduct.id, formData);
      setEditingProduct(null);
      setFormData(emptyProduct);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    setDeleting(id);
    try {
      await deleteProduct(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const handleStockAdjust = async () => {
    if (!stockAdjustProduct) return;
    setSaving(true);
    setError(null);
    try {
      await adjustStock(stockAdjustProduct.id, stockForm);
      setStockAdjustProduct(null);
      setStockForm({ quantity: 1, movement_type: 'in', reason: '', source: 'manual' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajustement');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdjust = async (product: Product, delta: number) => {
    try {
      await adjustStock(product.id, {
        quantity: Math.abs(delta),
        movement_type: delta > 0 ? 'in' : 'out',
        reason: 'Ajustement rapide',
        source: 'manual',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const openEdit = (product: Product) => {
    setFormData({ ...product });
    setEditingProduct(product);
  };

  const openMovements = async (product: Product) => {
    setMovementsProduct(product);
    setLoadingMovements(true);
    try {
      const data = await getStockMovements(product.id);
      setMovements(data);
    } catch {
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await importInventoryCSV(csvFile, csvSource);
      await loadData();
      const parts: string[] = [];
      if (res.created > 0) parts.push(`${res.created} produit${res.created > 1 ? 's' : ''} ajouté${res.created > 1 ? 's' : ''}`);
      if (res.skipped > 0) parts.push(`${res.skipped} ignoré${res.skipped > 1 ? 's' : ''} (déjà présents)`);
      setSuccessMsg(parts.length > 0 ? parts.join(', ') + '.' : 'Aucun nouveau produit à importer.');
      if (res.errors.length > 0) setError(res.errors.join(' | '));
      setShowCsvImport(false);
      setCsvFile(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'import');
    } finally {
      setCsvImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventaire</h1>
          <p className="text-sm text-secondary-500 mt-1">Gestion du stock physique et merch</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCsvImport(true); setCsvFile(null); }}
            className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            disabled={autoDiscovering}
            onClick={async () => {
              setAutoDiscovering(true);
              setError(null);
              setSuccessMsg(null);
              try {
                const discovered = await autoDiscoverProducts();
                await loadData();
                if (discovered.length === 0) {
                  setSuccessMsg('Catalogue déjà à jour — aucun nouveau produit trouvé.');
                } else {
                  const byFormat = discovered.reduce<Record<string, number>>((acc, p) => {
                    acc[p.format] = (acc[p.format] || 0) + 1;
                    return acc;
                  }, {});
                  const breakdown = Object.entries(byFormat)
                    .sort(([, a], [, b]) => b - a)
                    .map(([fmt, n]) => `${n} ${FORMAT_LABELS[fmt] || fmt}`)
                    .join(', ');
                  setSuccessMsg(`${discovered.length} produit${discovered.length > 1 ? 's' : ''} ajouté${discovered.length > 1 ? 's' : ''} à l'inventaire : ${breakdown}.`);
                }
              } catch (err: any) {
                setError(err.message || 'Erreur lors de la découverte');
              } finally {
                setAutoDiscovering(false);
              }
            }}
            className="px-4 py-2 bg-default-100 text-foreground rounded-xl font-medium hover:bg-default-200 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoDiscovering ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Auto-découvrir
          </button>
          <button
            onClick={() => {
              setFormData(emptyProduct);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau produit
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-4 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 underline shrink-0">Fermer</button>
        </div>
      )}

      {/* Success */}
      {successMsg && (
        <div className="bg-success/10 border border-success/30 text-success rounded-xl p-4 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-4 underline shrink-0">Fermer</button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-default-50 rounded-2xl p-4 border border-divider">
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Produits</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.total_products}</p>
          </div>
          <div className="bg-default-50 rounded-2xl p-4 border border-divider">
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Stock total</p>
            <p className="text-2xl font-bold text-foreground mt-1">{summary.total_stock}</p>
          </div>
          <div className={`rounded-2xl p-4 border ${summary.low_stock_count > 0 ? 'bg-warning/10 border-warning/30' : 'bg-default-50 border-divider'}`}>
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Stock faible</p>
            <p className={`text-2xl font-bold mt-1 ${summary.low_stock_count > 0 ? 'text-warning' : 'text-foreground'}`}>
              {summary.low_stock_count}
            </p>
          </div>
          <div className="bg-default-50 rounded-2xl p-4 border border-divider">
            <p className="text-xs text-secondary-500 uppercase tracking-wide">Valeur totale</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.total_value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>
        </div>
      )}

      {/* Par format */}
      {summary && Object.keys(summary.by_format || {}).length > 0 && (
        <div className="bg-default-50 rounded-2xl p-4 border border-divider">
          <p className="text-xs text-secondary-500 uppercase tracking-wide mb-3">Répartition par format</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.by_format)
              .sort(([, a], [, b]) => b - a)
              .map(([fmt, count]) => (
                <button
                  key={fmt}
                  onClick={() => setFormatFilter(formatFilter === fmt ? '' : fmt)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border ${
                    formatFilter === fmt
                      ? 'bg-primary text-white border-primary'
                      : 'bg-default-100 text-foreground border-divider hover:bg-default-200'
                  }`}
                >
                  {FORMAT_LABELS[fmt] || fmt} · {count}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          {fetching ? (
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          value={formatFilter}
          onChange={e => setFormatFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
        >
          <option value="">Tous les formats</option>
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-secondary-600 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={e => setLowStockOnly(e.target.checked)}
            className="rounded border-divider"
          />
          Stock faible
        </label>
      </div>

      {/* Products Table */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-default-50 rounded-2xl border border-divider">
          <svg className="w-12 h-12 mx-auto text-secondary-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-secondary-500">Aucun produit trouvé</p>
          <button
            onClick={() => { setFormData(emptyProduct); setShowCreateModal(true); }}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Ajouter un produit
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left">
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Produit</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Format</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Stock</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Prix</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Statut</th>
                <th className="pb-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const isLowStock = product.stock_quantity <= product.low_stock_threshold;
                return (
                  <tr key={product.id} className="border-b border-divider/50 hover:bg-default-50 transition-colors">
                    {/* Product info */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={FORMAT_ICONS[product.format] || FORMAT_ICONS.other} />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{product.title}</p>
                          <div className="flex items-center gap-2 text-xs text-secondary-500">
                            {product.variant && <span>{product.variant}</span>}
                            {product.artist_name && <span>{product.artist_name}</span>}
                            {product.limited_edition && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">
                                LTD{product.edition_size ? ` /${product.edition_size}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Format */}
                    <td className="py-3 pr-4">
                      <span className="px-2 py-1 bg-default-100 rounded-lg text-xs font-medium text-secondary-600">
                        {FORMAT_LABELS[product.format] || product.format}
                      </span>
                    </td>

                    {/* Stock with quick adjust */}
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuickAdjust(product, -1)}
                            className="w-6 h-6 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center text-secondary-600 transition-colors"
                            title="Retirer 1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className={`font-bold min-w-[2rem] text-center ${isLowStock ? 'text-danger' : 'text-foreground'}`}>
                            {product.stock_quantity}
                          </span>
                          <button
                            onClick={() => handleQuickAdjust(product, 1)}
                            className="w-6 h-6 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center text-secondary-600 transition-colors"
                            title="Ajouter 1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                          {isLowStock && (
                            <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          )}
                        </div>
                        {(product.total_sold ?? 0) > 0 && (
                          <span className="text-[11px] text-secondary-500">
                            {product.total_sold} vendu{(product.total_sold ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 pr-4 text-foreground">
                      {product.price_eur != null
                        ? product.price_eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                        : '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[product.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[product.status] || product.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setStockAdjustProduct(product);
                            setStockForm({ quantity: 1, movement_type: 'in', reason: '', source: 'manual' });
                          }}
                          className="p-1.5 rounded-lg hover:bg-default-100 text-secondary-500 hover:text-primary transition-colors"
                          title="Ajuster le stock"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openMovements(product)}
                          className="p-1.5 rounded-lg hover:bg-default-100 text-secondary-500 hover:text-foreground transition-colors"
                          title="Historique"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 rounded-lg hover:bg-default-100 text-secondary-500 hover:text-foreground transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                          className="p-1.5 rounded-lg hover:bg-danger/10 text-secondary-500 hover:text-danger transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {(showCreateModal || editingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-lg max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">
                {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Titre *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  placeholder="Nom du produit"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Format *</label>
                  <select
                    value={formData.format || 'vinyl'}
                    onChange={e => setFormData({ ...formData, format: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Statut</label>
                  <select
                    value={formData.status || 'available'}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Variante</label>
                  <input
                    type="text"
                    value={formData.variant || ''}
                    onChange={e => setFormData({ ...formData, variant: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                    placeholder="ex: Couleur, édition..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Artiste</label>
                  <input
                    type="text"
                    value={formData.artist_name || ''}
                    onChange={e => setFormData({ ...formData, artist_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                    placeholder="Nom de l'artiste"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">UPC</label>
                  <input
                    type="text"
                    value={formData.release_upc || ''}
                    onChange={e => setFormData({ ...formData, release_upc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Prix (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price_eur ?? ''}
                    onChange={e => setFormData({ ...formData, price_eur: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Coût (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_eur ?? ''}
                    onChange={e => setFormData({ ...formData, cost_eur: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Stock initial</label>
                  <input
                    type="number"
                    value={formData.stock_quantity ?? 0}
                    onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Seuil stock faible</label>
                  <input
                    type="number"
                    value={formData.low_stock_threshold ?? 5}
                    onChange={e => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limited_edition || false}
                    onChange={e => setFormData({ ...formData, limited_edition: e.target.checked })}
                    className="rounded border-divider"
                  />
                  Édition limitée
                </label>
                {formData.limited_edition && (
                  <div className="flex-1">
                    <input
                      type="number"
                      placeholder="Taille de l'édition"
                      value={formData.edition_size ?? ''}
                      onChange={e => setFormData({ ...formData, edition_size: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">URL image</label>
                <input
                  type="text"
                  value={formData.image_url || ''}
                  onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-6 border-t border-divider flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}
                className="px-4 py-2 rounded-xl bg-default-100 text-secondary-600 text-sm font-medium hover:bg-default-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={editingProduct ? handleUpdate : handleCreate}
                disabled={saving || !formData.title}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : editingProduct ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockAdjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setStockAdjustProduct(null)}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">Ajuster le stock</h2>
              <p className="text-sm text-secondary-500 mt-1">{stockAdjustProduct.title}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Quantité</label>
                  <input
                    type="number"
                    min={1}
                    value={stockForm.quantity}
                    onChange={e => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary-500 mb-1">Type</label>
                  <select
                    value={stockForm.movement_type}
                    onChange={e => setStockForm({ ...stockForm, movement_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  >
                    {MOVEMENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Source</label>
                <select
                  value={stockForm.source}
                  onChange={e => setStockForm({ ...stockForm, source: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                >
                  {MOVEMENT_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-1">Raison</label>
                <input
                  type="text"
                  value={stockForm.reason}
                  onChange={e => setStockForm({ ...stockForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-default-100 border border-divider text-sm text-foreground"
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="p-6 border-t border-divider flex justify-end gap-3">
              <button
                onClick={() => setStockAdjustProduct(null)}
                className="px-4 py-2 rounded-xl bg-default-100 text-secondary-600 text-sm font-medium hover:bg-default-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCsvImport(false)}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">Import CSV</h2>
              <p className="text-sm text-secondary-500 mt-1">Importer des produits physiques depuis Bandcamp ou Squarespace</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-2">Source</label>
                <div className="flex gap-2">
                  {(['bandcamp', 'squarespace'] as const).map(src => (
                    <button
                      key={src}
                      onClick={() => setCsvSource(src)}
                      className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        csvSource === src
                          ? 'bg-primary text-white border-primary'
                          : 'bg-default-50 text-secondary-600 border-divider hover:bg-default-100'
                      }`}
                    >
                      {src === 'bandcamp' ? 'Bandcamp' : 'Squarespace'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-secondary-500 mb-2">Fichier CSV</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-divider rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                  />
                  {csvFile ? (
                    <div className="text-center px-4">
                      <svg className="w-6 h-6 text-primary mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-foreground truncate max-w-xs">{csvFile.name}</p>
                      <p className="text-xs text-secondary-500 mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg className="w-8 h-8 text-secondary-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm text-secondary-500">Cliquer pour sélectionner un fichier</p>
                      <p className="text-xs text-secondary-400 mt-0.5">CSV uniquement</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-divider flex justify-end gap-3">
              <button
                onClick={() => { setShowCsvImport(false); setCsvFile(null); }}
                className="px-4 py-2 rounded-xl bg-default-100 text-secondary-600 text-sm font-medium hover:bg-default-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCsvImport}
                disabled={!csvFile || csvImporting}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {csvImporting ? <Spinner size="sm" color="white" /> : null}
                {csvImporting ? 'Import en cours...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movements History Modal */}
      {movementsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setMovementsProduct(null)}>
          <div className="bg-background rounded-2xl shadow-xl border border-divider w-full max-w-lg max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-divider">
              <h2 className="text-lg font-bold text-foreground">Historique des mouvements</h2>
              <p className="text-sm text-secondary-500 mt-1">{movementsProduct.title}</p>
            </div>
            <div className="p-6">
              {loadingMovements ? (
                <div className="flex justify-center py-8"><Spinner size="sm" /></div>
              ) : movements.length === 0 ? (
                <p className="text-center text-secondary-500 py-8">Aucun mouvement enregistré</p>
              ) : (
                <div className="space-y-3">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-default-50 rounded-xl">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        m.movement_type === 'in' || m.movement_type === 'return' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d={m.movement_type === 'in' || m.movement_type === 'return' ? 'M12 19V5m0 0l-4 4m4-4l4 4' : 'M12 5v14m0 0l-4-4m4 4l4-4'}
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {m.movement_type === 'in' ? '+' : m.movement_type === 'return' ? '+' : '-'}{m.quantity}
                          </span>
                          <span className="text-xs text-secondary-500">
                            {MOVEMENT_TYPES.find(t => t.value === m.movement_type)?.label || m.movement_type}
                          </span>
                          {m.source && (
                            <span className="text-xs text-secondary-400">
                              ({MOVEMENT_SOURCES.find(s => s.value === m.source)?.label || m.source})
                            </span>
                          )}
                        </div>
                        {m.reason && <p className="text-xs text-secondary-500 mt-0.5">{m.reason}</p>}
                      </div>
                      <span className="text-xs text-secondary-400 flex-shrink-0">
                        {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-divider flex justify-end">
              <button
                onClick={() => setMovementsProduct(null)}
                className="px-4 py-2 rounded-xl bg-default-100 text-secondary-600 text-sm font-medium hover:bg-default-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
