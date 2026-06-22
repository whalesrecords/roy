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
  recalculateStock,
  Product,
  InventorySummary,
  StockMovement,
} from '@/lib/api';
import { Card, Eyebrow, Pill, Kpi, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconPlus, IconImport } from '@/components/roy/icons';
import AssetsTab from './AssetsTab';

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

const STATUS_TONE: Record<string, 'accent' | 'neutral'> = {
  available: 'accent',
  sold_out: 'neutral',
  preorder: 'accent',
  discontinued: 'neutral',
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
  initial_stock_quantity: 300,
  low_stock_threshold: 5,
  status: 'available',
  limited_edition: false,
  edition_size: undefined,
  image_url: '',
  notes: '',
};

const inputClass =
  'w-full h-11 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

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
  const [recalculatingStock, setRecalculatingStock] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'assets'>('products');

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const formatEUR = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

  // ── Group products by release (release_upc, else title+artist) so a release
  // with several format variants shows as an expandable folder ──
  interface ProductGroup {
    key: string; title: string; artist?: string; image_url?: string;
    items: Product[]; totalStock: number; totalSold: number;
  }
  const productGroups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const p of products) {
      const key = (p.release_upc && p.release_upc.trim())
        || `${p.title.trim().toLowerCase()}|${(p.artist_name || '').trim().toLowerCase()}`;
      let g = map.get(key);
      if (!g) {
        g = { key, title: p.title, artist: p.artist_name, image_url: p.image_url, items: [], totalStock: 0, totalSold: 0 };
        map.set(key, g);
      }
      g.items.push(p);
      g.totalStock += p.stock_quantity || 0;
      g.totalSold += p.total_sold || 0;
      if (!g.image_url && p.image_url) g.image_url = p.image_url;
    }
    return Array.from(map.values());
  }, [products]);

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const renderProductRow = (product: Product, asVariant = false) => {
    const isLowStock = product.stock_quantity <= product.low_stock_threshold;
    const primaryLabel = asVariant
      ? (product.variant || FORMAT_LABELS[product.format] || product.format)
      : product.title;
    const subParts = (asVariant
      ? [FORMAT_LABELS[product.format] || product.format, product.sku]
      : [product.variant, product.artist_name]
    ).filter(Boolean) as string[];
    return (
      <div
        key={product.id}
        className={`grid grid-cols-[2.4fr_0.9fr_1.4fr_0.9fr_0.9fr_1.1fr] items-center py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors ${asVariant ? 'pl-[52px] pr-[22px] bg-surface-2/20' : 'px-[22px]'}`}
      >
        {/* Product info */}
        <div className="flex items-center gap-3 min-w-0 pr-3">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.title} className="w-10 h-10 rounded-[10px] object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-[10px] bg-surface-2 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={FORMAT_ICONS[product.format] || FORMAT_ICONS.other} />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink truncate">{primaryLabel}</p>
            <div className="flex items-center gap-2 text-[11px] text-ink-faint mt-0.5">
              {subParts.map((s, i) => <span key={i} className="truncate">{s}</span>)}
              {product.limited_edition && (
                <span className="inline-flex items-center rounded-full bg-accent-soft text-accent px-2 py-[2px] text-[9.5px] font-bold tracking-wide">
                  LTD{product.edition_size ? ` /${product.edition_size}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Format */}
        <div><Pill tone="neutral">{FORMAT_LABELS[product.format] || product.format}</Pill></div>

        {/* Stock with quick adjust */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuickAdjust(product, -1)}
              className="w-6 h-6 rounded-full bg-surface-2 hover:bg-track flex items-center justify-center text-ink-muted transition-colors"
              title="Retirer 1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            </button>
            <span className={`roy-num font-bold min-w-[2rem] text-center ${isLowStock ? 'text-neg' : 'text-ink'}`}>{product.stock_quantity}</span>
            <button
              onClick={() => handleQuickAdjust(product, 1)}
              className="w-6 h-6 rounded-full bg-surface-2 hover:bg-track flex items-center justify-center text-ink-muted transition-colors"
              title="Ajouter 1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            {isLowStock && (
              <svg className="w-4 h-4 text-neg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            )}
          </div>
          {((product.total_sold ?? 0) > 0 || (product.initial_stock_quantity ?? 0) > 0) && (
            <span className="text-[11px] text-ink-faint">
              {(product.initial_stock_quantity ?? 0) > 0 && (<>/ <span className="roy-num">{product.initial_stock_quantity}</span> pressés </>)}
              {(product.total_sold ?? 0) > 0 && (<>· <span className="roy-num">{product.total_sold}</span> vendu{(product.total_sold ?? 0) > 1 ? 's' : ''}</>)}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="text-right roy-num text-[13px] text-ink">{product.price_eur != null ? formatEUR(product.price_eur) : '—'}</div>

        {/* Status */}
        <div><Pill tone={STATUS_TONE[product.status] || 'neutral'}>{STATUS_LABELS[product.status] || product.status}</Pill></div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => { setStockAdjustProduct(product); setStockForm({ quantity: 1, movement_type: 'in', reason: '', source: 'manual' }); }} className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-accent transition-colors" title="Ajuster le stock">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          </button>
          <button onClick={() => openMovements(product)} className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-ink transition-colors" title="Historique">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button onClick={() => openEdit(product)} className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-ink transition-colors" title="Modifier">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => handleDelete(product.id)} disabled={deleting === product.id} className="p-1.5 rounded-[8px] hover:bg-surface text-ink-faint hover:text-neg transition-colors disabled:opacity-50" title="Supprimer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    );
  };

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
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Inventaire</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            {activeTab === 'products' ? 'Gestion du stock physique et merch' : 'Immobilisations corporelles & incorporelles'}
          </p>
        </div>
        <div className={`flex items-center gap-2.5 ${activeTab === 'assets' ? 'hidden' : ''}`}>
          <OutlineButton onClick={() => { setShowCsvImport(true); setCsvFile(null); }}>
            <IconImport size={14} /> Import CSV
          </OutlineButton>
          <OutlineButton
            onClick={async () => {
              if (recalculatingStock) return;
              setRecalculatingStock(true);
              setError(null);
              setSuccessMsg(null);
              try {
                const res = await recalculateStock();
                await loadData();
                setSuccessMsg(`Stock recalculé sur ${res.updated} / ${res.total} produit${res.total > 1 ? 's' : ''} à partir des ventes (base ${res.initial_stock_default}).`);
              } catch (err: any) {
                setError(err.message || 'Erreur lors du recalcul');
              } finally {
                setRecalculatingStock(false);
              }
            }}
            className={recalculatingStock ? 'opacity-50 pointer-events-none' : ''}
          >
            {recalculatingStock ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Recalculer stock
          </OutlineButton>
          <OutlineButton
            onClick={async () => {
              if (autoDiscovering) return;
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
            className={autoDiscovering ? 'opacity-50 pointer-events-none' : ''}
          >
            {autoDiscovering ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Auto-découvrir
          </OutlineButton>
          <AccentButton
            onClick={() => {
              setFormData(emptyProduct);
              setShowCreateModal(true);
            }}
          >
            <IconPlus size={14} /> Nouveau produit
          </AccentButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Tabs — segmented pill control */}
        <div className="flex gap-1 rounded-[11px] border border-line bg-surface p-1 w-fit">
          {([
            { key: 'products', label: 'Produits & merch' },
            { key: 'assets', label: 'Immobilisations' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                activeTab === t.key
                  ? 'bg-accent-soft text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink font-medium'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'assets' ? (
          <AssetsTab />
        ) : (
        <>

        {/* Error */}
        {error && (
          <div className="bg-surface border border-line rounded-[16px] px-4 py-3 text-[12.5px] text-neg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 underline shrink-0 text-ink-muted hover:text-ink">Fermer</button>
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="bg-surface border border-line rounded-[16px] px-4 py-3 text-[12.5px] text-accent flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="ml-4 underline shrink-0 text-ink-muted hover:text-ink">Fermer</button>
          </div>
        )}

        {/* Summary KPIs */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <Kpi label="Produits" value={String(summary.total_products)} />
            <Kpi label="Stock total" value={String(summary.total_stock)} />
            <Kpi
              label="Stock faible"
              value={String(summary.low_stock_count)}
              accentValue={summary.low_stock_count > 0}
              hint={summary.low_stock_count > 0 ? 'À réapprovisionner' : undefined}
              hintTone="accent"
            />
            <Kpi label="Valeur totale" value={formatEUR(summary.total_value)} hero accentValue />
          </div>
        )}

        {/* Par format */}
        {summary && Object.keys(summary.by_format || {}).length > 0 && (
          <Card>
            <Eyebrow>Répartition par format</Eyebrow>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(summary.by_format)
                .sort(([, a], [, b]) => b - a)
                .map(([fmt, count]) => {
                  const active = formatFilter === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => setFormatFilter(active ? '' : fmt)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-[5px] text-[11px] font-semibold transition-colors ${
                        active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-muted hover:text-ink'
                      }`}
                    >
                      {FORMAT_LABELS[fmt] || fmt} · <span className="roy-num">{count}</span>
                    </button>
                  );
                })}
            </div>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            {fetching ? (
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              type="text"
              placeholder="Rechercher un produit…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-11 w-full pl-10 pr-4 rounded-[10px] bg-surface border border-line text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
            />
          </div>

          <select
            value={formatFilter}
            onChange={e => setFormatFilter(e.target.value)}
            className="h-11 px-3.5 rounded-[10px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
          >
            <option value="">Tous les formats</option>
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-11 px-3.5 rounded-[10px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-[12.5px] text-ink-muted cursor-pointer px-1">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={e => setLowStockOnly(e.target.checked)}
              className="rounded border-line accent-[var(--accent)]"
            />
            Stock faible
          </label>
        </div>

        {/* Products Table */}
        {products.length === 0 ? (
          <Card className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-ink-faint mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-ink-faint text-[13px]">Aucun produit trouvé</p>
            <div className="mt-4 flex justify-center">
              <AccentButton onClick={() => { setFormData(emptyProduct); setShowCreateModal(true); }}>
                <IconPlus size={14} /> Ajouter un produit
              </AccentButton>
            </div>
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[2.4fr_0.9fr_1.4fr_0.9fr_0.9fr_1.1fr] px-[22px] py-3 border-b border-line">
              <Eyebrow className="text-[10px]">Produit</Eyebrow>
              <Eyebrow className="text-[10px]">Format</Eyebrow>
              <Eyebrow className="text-[10px]">Stock</Eyebrow>
              <Eyebrow className="text-[10px] text-right">Prix</Eyebrow>
              <Eyebrow className="text-[10px]">Statut</Eyebrow>
              <Eyebrow className="text-[10px] text-right">Actions</Eyebrow>
            </div>
            {productGroups.map(group => {
              if (group.items.length === 1) return renderProductRow(group.items[0]);
              const open = expandedGroups.has(group.key);
              return (
                <div key={group.key} className="border-b border-line last:border-0">
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-3 px-[22px] py-3.5 text-left hover:bg-surface-2 transition-colors"
                  >
                    <svg className={`w-4 h-4 shrink-0 text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" /></svg>
                    <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0 overflow-hidden">
                      {group.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={group.image_url} alt={group.title} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{group.title}</p>
                      <div className="text-[11px] text-ink-faint mt-0.5 truncate">{group.artist ? `${group.artist} · ` : ''}{group.items.length} variantes</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`roy-num font-bold ${group.totalStock <= 0 ? 'text-neg' : 'text-ink'}`}>{group.totalStock}</div>
                      <div className="text-[11px] text-ink-faint">en stock{group.totalSold > 0 ? ` · ${group.totalSold} vendus` : ''}</div>
                    </div>
                  </button>
                  {open && group.items.map(p => renderProductRow(p, true))}
                </div>
              );
            })}
          </Card>
        )}

        {/* Create / Edit Product Modal */}
        {(showCreateModal || editingProduct) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}>
            <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-line">
                <h2 className="text-[16px] font-bold text-ink">
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </h2>
              </div>
              <div className="px-6 py-5 overflow-y-auto max-h-[64vh] space-y-4">
                <div>
                  <label className={labelClass}>Titre *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className={inputClass}
                    placeholder="Nom du produit"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Format *</label>
                    <select
                      value={formData.format || 'vinyl'}
                      onChange={e => setFormData({ ...formData, format: e.target.value })}
                      className={inputClass}
                    >
                      {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Statut</label>
                    <select
                      value={formData.status || 'available'}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className={inputClass}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Variante</label>
                    <input
                      type="text"
                      value={formData.variant || ''}
                      onChange={e => setFormData({ ...formData, variant: e.target.value })}
                      className={inputClass}
                      placeholder="ex: Couleur, édition..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Artiste</label>
                    <input
                      type="text"
                      value={formData.artist_name || ''}
                      onChange={e => setFormData({ ...formData, artist_name: e.target.value })}
                      className={inputClass}
                      placeholder="Nom de l'artiste"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>SKU</label>
                    <input
                      type="text"
                      value={formData.sku || ''}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>UPC</label>
                    <input
                      type="text"
                      value={formData.release_upc || ''}
                      onChange={e => setFormData({ ...formData, release_upc: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Prix (EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price_eur ?? ''}
                      onChange={e => setFormData({ ...formData, price_eur: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Coût (EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_eur ?? ''}
                      onChange={e => setFormData({ ...formData, cost_eur: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Pressage (base)</label>
                    <input
                      type="number"
                      value={formData.initial_stock_quantity ?? 300}
                      onChange={e => setFormData({ ...formData, initial_stock_quantity: parseInt(e.target.value) || 0 })}
                      className={inputClass}
                      title="Nombre d'unités pressées (sert au recalcul stock = base − vendus)"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Stock actuel</label>
                    <input
                      type="number"
                      value={formData.stock_quantity ?? 0}
                      onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Seuil alerte</label>
                    <input
                      type="number"
                      value={formData.low_stock_threshold ?? 5}
                      onChange={e => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.limited_edition || false}
                      onChange={e => setFormData({ ...formData, limited_edition: e.target.checked })}
                      className="rounded border-line accent-[var(--accent)]"
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
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>URL image</label>
                  <input
                    type="text"
                    value={formData.image_url || ''}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
                <OutlineButton onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}>
                  Annuler
                </OutlineButton>
                <AccentButton
                  onClick={editingProduct ? handleUpdate : handleCreate}
                  disabled={saving || !formData.title}
                >
                  {saving && <Spinner size="sm" color="white" />}
                  {saving ? 'Enregistrement...' : editingProduct ? 'Mettre à jour' : 'Créer'}
                </AccentButton>
              </div>
            </div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {stockAdjustProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setStockAdjustProduct(null)}>
            <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-line">
                <h2 className="text-[16px] font-bold text-ink">Ajuster le stock</h2>
                <p className="text-[12.5px] text-ink-faint mt-0.5">{stockAdjustProduct.title}</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={stockForm.quantity}
                      onChange={e => setStockForm({ ...stockForm, quantity: parseInt(e.target.value) || 1 })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Type</label>
                    <select
                      value={stockForm.movement_type}
                      onChange={e => setStockForm({ ...stockForm, movement_type: e.target.value })}
                      className={inputClass}
                    >
                      {MOVEMENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Source</label>
                  <select
                    value={stockForm.source}
                    onChange={e => setStockForm({ ...stockForm, source: e.target.value })}
                    className={inputClass}
                  >
                    {MOVEMENT_SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Raison</label>
                  <input
                    type="text"
                    value={stockForm.reason}
                    onChange={e => setStockForm({ ...stockForm, reason: e.target.value })}
                    className={inputClass}
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
                <OutlineButton onClick={() => setStockAdjustProduct(null)}>
                  Annuler
                </OutlineButton>
                <AccentButton onClick={handleStockAdjust} disabled={saving}>
                  {saving && <Spinner size="sm" color="white" />}
                  {saving ? 'Enregistrement...' : 'Valider'}
                </AccentButton>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCsvImport(false)}>
            <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-line">
                <h2 className="text-[16px] font-bold text-ink">Import CSV</h2>
                <p className="text-[12.5px] text-ink-faint mt-0.5">Importer des produits physiques depuis Bandcamp ou Squarespace</p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={labelClass}>Source</label>
                  <div className="flex gap-2">
                    {(['bandcamp', 'squarespace'] as const).map(src => (
                      <button
                        key={src}
                        onClick={() => setCsvSource(src)}
                        className={`flex-1 px-4 py-2.5 rounded-[10px] border text-[12.5px] font-semibold transition-colors ${
                          csvSource === src
                            ? 'bg-accent text-accent-ink border-accent'
                            : 'bg-surface text-ink-muted border-line hover:bg-surface-2'
                        }`}
                      >
                        {src === 'bandcamp' ? 'Bandcamp' : 'Squarespace'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Fichier CSV</label>
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-line rounded-[12px] cursor-pointer hover:border-line-strong hover:bg-surface-2 transition-colors">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
                    />
                    {csvFile ? (
                      <div className="text-center px-4">
                        <svg className="w-6 h-6 text-accent mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-[13px] font-semibold text-ink truncate max-w-xs">{csvFile.name}</p>
                        <p className="text-[11px] text-ink-faint mt-0.5">{(csvFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="w-8 h-8 text-ink-faint mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-[13px] text-ink-muted">Cliquer pour sélectionner un fichier</p>
                        <p className="text-[11px] text-ink-faint mt-0.5">CSV uniquement</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
                <OutlineButton onClick={() => { setShowCsvImport(false); setCsvFile(null); }}>
                  Annuler
                </OutlineButton>
                <AccentButton
                  onClick={handleCsvImport}
                  disabled={!csvFile || csvImporting}
                >
                  {csvImporting ? <Spinner size="sm" color="white" /> : null}
                  {csvImporting ? 'Import en cours...' : 'Importer'}
                </AccentButton>
              </div>
            </div>
          </div>
        )}

        {/* Movements History Modal */}
        {movementsProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setMovementsProduct(null)}>
            <div className="relative bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-5 border-b border-line">
                <h2 className="text-[16px] font-bold text-ink">Historique des mouvements</h2>
                <p className="text-[12.5px] text-ink-faint mt-0.5">{movementsProduct.title}</p>
              </div>
              <div className="px-6 py-5 overflow-y-auto max-h-[56vh]">
                {loadingMovements ? (
                  <div className="flex justify-center py-8"><Spinner size="sm" /></div>
                ) : movements.length === 0 ? (
                  <p className="text-center text-ink-faint text-[13px] py-8">Aucun mouvement enregistré</p>
                ) : (
                  <div className="space-y-2.5">
                    {movements.map(m => {
                      const inbound = m.movement_type === 'in' || m.movement_type === 'return';
                      return (
                        <div key={m.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-[12px]">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            inbound ? 'bg-accent-soft text-accent' : 'bg-surface text-ink-muted border border-line'
                          }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d={inbound ? 'M12 19V5m0 0l-4 4m4-4l4 4' : 'M12 5v14m0 0l-4-4m4 4l4-4'}
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="roy-num text-[13px] font-semibold text-ink">
                                {m.movement_type === 'in' ? '+' : m.movement_type === 'return' ? '+' : '-'}{m.quantity}
                              </span>
                              <span className="text-[11px] text-ink-faint">
                                {MOVEMENT_TYPES.find(t => t.value === m.movement_type)?.label || m.movement_type}
                              </span>
                              {m.source && (
                                <span className="text-[11px] text-ink-faint">
                                  ({MOVEMENT_SOURCES.find(s => s.value === m.source)?.label || m.source})
                                </span>
                              )}
                            </div>
                            {m.reason && <p className="text-[11px] text-ink-faint mt-0.5">{m.reason}</p>}
                          </div>
                          <span className="text-[11px] text-ink-faint flex-shrink-0">
                            {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-line flex justify-end bg-surface-2">
                <OutlineButton onClick={() => setMovementsProduct(null)}>
                  Fermer
                </OutlineButton>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
