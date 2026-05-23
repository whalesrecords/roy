'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getExpenses, Expense } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

// Category icons (SVG paths)
const CATEGORY_ICONS: Record<string, string> = {
  mastering: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
  mixing: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  recording: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  photos: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  video: 'M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  advertising: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  groover: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  submithub: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  distribution: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  artwork: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  cd: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  vinyl: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
  pr: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  other: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
};

const CATEGORY_COLORS: Record<string, string> = {
  mastering: 'bg-purple-500/10 text-purple-400',
  mixing: 'bg-indigo-500/10 text-indigo-400',
  recording: 'bg-red-500/10 text-red-400',
  photos: 'bg-pink-500/10 text-pink-400',
  video: 'bg-rose-500/10 text-rose-400',
  advertising: 'bg-orange-500/10 text-orange-400',
  groover: 'bg-orange-500/10 text-orange-400',
  submithub: 'bg-blue-500/10 text-blue-400',
  distribution: 'bg-teal-500/10 text-teal-400',
  artwork: 'bg-fuchsia-500/10 text-fuchsia-400',
  cd: 'bg-slate-500/10 text-slate-400',
  vinyl: 'bg-slate-500/10 text-slate-400',
  pr: 'bg-cyan-500/10 text-cyan-400',
  other: 'bg-default-100 text-default-500',
};

const BAR_COLORS = [
  '#818cf8', '#34d399', '#f59e0b', '#f43f5e',
  '#a78bfa', '#22d3ee', '#fb923c', '#4ade80',
];

function getIconPath(category?: string): string {
  return CATEGORY_ICONS[category || 'other'] || CATEGORY_ICONS.other;
}
function getColor(category?: string): string {
  return CATEGORY_COLORS[category || 'other'] || CATEGORY_COLORS.other;
}

/** Open a document URL in a new tab. Supports both https:// and data: URLs. */
function openDocument(url: string) {
  if (url.startsWith('data:')) {
    // Convert base64 data URL to a Blob object URL to avoid XSS risks
    const [meta, b64] = url.split(',');
    const mime = meta.split(':')[1]?.split(';')[0] ?? 'application/octet-stream';
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }
}

type ScopeFilter = 'all' | 'track' | 'release' | 'catalog';

export default function ExpensesPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [scopeItemFilter, setScopeItemFilter] = useState<string | null>(null);

  useEffect(() => {
    if (artist) loadExpenses();
  }, [artist]);

  const loadExpenses = async () => {
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (amount: string | number, currency = 'EUR') =>
    (typeof amount === 'string' ? parseFloat(amount) : amount)
      .toLocaleString('fr-FR', { style: 'currency', currency });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatMonthHeader = (key: string) => {
    const [year, month] = key.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // Unique scope items for second-level filter
  const uniqueTracks = useMemo(() =>
    [...new Set(expenses.filter(e => e.scope === 'track' && e.scope_title).map(e => e.scope_title!))].sort(),
    [expenses]
  );
  const uniqueReleases = useMemo(() =>
    [...new Set(expenses.filter(e => e.scope === 'release' && e.scope_title).map(e => e.scope_title!))].sort(),
    [expenses]
  );

  // Filtered expenses
  const filtered = useMemo(() => {
    let result = expenses;
    if (scopeFilter !== 'all') result = result.filter(e => e.scope === scopeFilter);
    if (scopeItemFilter) result = result.filter(e => e.scope_title === scopeItemFilter);
    if (categoryFilter) result = result.filter(e => e.category === categoryFilter);
    return result;
  }, [expenses, scopeFilter, scopeItemFilter, categoryFilter]);

  const totalFiltered = useMemo(
    () => filtered.reduce((sum, e) => sum + parseFloat(e.amount), 0),
    [filtered]
  );

  // Category breakdown of filtered expenses
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; total: number }>();
    filtered.forEach(e => {
      const key = e.category || 'other';
      const label = e.category_label || 'Autre';
      const existing = map.get(key) || { label, total: 0 };
      existing.total += parseFloat(e.amount);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, label: val.label, total: val.total, pct: totalFiltered > 0 ? (val.total / totalFiltered) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, totalFiltered]);

  // Unique categories for filter pills
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    filtered.forEach(e => { if (e.category) map.set(e.category, e.category_label || e.category); });
    return Array.from(map.entries());
  }, [filtered]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups = new Map<string, Expense[]>();
    sorted.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const arr = groups.get(key) || [];
      arr.push(e);
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
  }, [filtered]);

  if (!artist && !authLoading) return null;

  const scopeItems = scopeFilter === 'track' ? uniqueTracks : scopeFilter === 'release' ? uniqueReleases : [];

  return (
    <div className="min-h-screen bg-background safe-top">
      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-4">
        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        ) : (
        <>
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary card */}
        <div className="relative overflow-hidden rounded-3xl bg-content1 border border-white/[0.06] p-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-danger/40 to-transparent" />
          <p className="text-[10px] font-semibold text-default-400 uppercase tracking-[0.15em] mb-1">Total dépenses</p>
          <p className="text-3xl font-black text-foreground leading-none">{fmt(totalFiltered)}</p>
          <p className="text-xs text-default-400 mt-1">{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</p>
        </div>

        {/* Breakdown bar */}
        {categoryBreakdown.length > 1 && (
          <div className="bg-content1 border border-divider rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-semibold text-default-400 uppercase tracking-widest">Répartition</p>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              {categoryBreakdown.map((cat, i) => (
                <div
                  key={cat.key}
                  style={{ width: `${cat.pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                  title={`${cat.label}: ${cat.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {categoryBreakdown.map((cat, i) => (
                <div key={cat.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    <span className="text-xs text-foreground">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-default-400">{cat.pct.toFixed(0)}%</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">{fmt(cat.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scope filter */}
        {expenses.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-1 bg-content1 border border-divider rounded-xl p-1">
              {(['all', 'track', 'release', 'catalog'] as ScopeFilter[]).map(s => {
                const count = s === 'all' ? expenses.length : expenses.filter(e => e.scope === s).length;
                if (s !== 'all' && !count) return null;
                return (
                  <button
                    key={s}
                    onClick={() => { setScopeFilter(s); setScopeItemFilter(null); setCategoryFilter(null); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      scopeFilter === s ? 'bg-primary text-white' : 'text-default-500'
                    }`}
                  >
                    {s === 'all' ? 'Tout' : s === 'track' ? 'Track' : s === 'release' ? 'Album' : 'Général'}
                  </button>
                );
              })}
            </div>

            {/* Second-level: specific track or release */}
            {scopeItems.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setScopeItemFilter(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    !scopeItemFilter ? 'bg-primary text-white' : 'bg-content1 border border-divider text-default-500'
                  }`}
                >
                  Tout
                </button>
                {scopeItems.map(item => (
                  <button
                    key={item}
                    onClick={() => setScopeItemFilter(scopeItemFilter === item ? null : item)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      scopeItemFilter === item ? 'bg-primary text-white' : 'bg-content1 border border-divider text-default-500'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {/* Category filter pills */}
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    !categoryFilter ? 'bg-foreground text-background' : 'bg-content1 border border-divider text-default-500'
                  }`}
                >
                  Toutes catégories
                </button>
                {categories.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      categoryFilter === key ? 'bg-foreground text-background' : 'bg-content1 border border-divider text-default-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expense list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-default-500 text-sm">Aucune dépense</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedByMonth.map(([monthKey, items]) => (
              <div key={monthKey} className="space-y-2">
                <h3 className="text-[10px] font-semibold text-default-400 uppercase tracking-widest px-1">
                  {formatMonthHeader(monthKey)}
                </h3>
                <div className="space-y-2">
                  {items.map(expense => (
                    <div
                      key={expense.id}
                      className="bg-content1 border border-divider rounded-2xl p-3 flex items-center gap-3"
                    >
                      {/* Category icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getColor(expense.category)}`}>
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getIconPath(expense.category)} />
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {expense.category_label || 'Autre'}
                          </span>
                          {expense.scope_title && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-lg font-medium">
                              {expense.scope_title}
                            </span>
                          )}
                        </div>
                        {expense.description && (
                          <p className="text-xs text-default-400 truncate mt-0.5">{expense.description}</p>
                        )}
                        <p className="text-[10px] text-default-300 mt-0.5">{formatDate(expense.date)}</p>
                      </div>

                      {/* Amount + PDF */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <p className="font-bold text-danger text-sm tabular-nums">
                          -{fmt(expense.amount, expense.currency)}
                        </p>
                        {expense.document_url && (
                          <button
                            onClick={() => openDocument(expense.document_url!)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-default-100 rounded-lg text-[10px] text-default-500 hover:bg-default-200 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
