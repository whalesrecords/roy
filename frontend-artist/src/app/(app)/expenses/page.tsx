'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getExpenses, Expense } from '@/lib/api';

const categoryEmojis: Record<string, string> = {
  production: '🎛️',
  mixing: '🎚️',
  mastering: '🔊',
  recording: '🎙️',
  distribution: '📦',
  marketing: '📣',
  promotion: '📢',
  artwork: '🎨',
  video: '🎬',
  legal: '⚖️',
  travel: '✈️',
  equipment: '🎸',
  session: '🎹',
  other: '📋',
};

function getCategoryEmoji(category?: string): string {
  if (!category) return '📋';
  return categoryEmojis[category] || '📋';
}

export default function ExpensesPage() {
  const { artist, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadExpenses();
    }
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

  const formatCurrency = (value: number) => {
    return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0),
    [expenses]
  );

  // Unique categories for filter pills
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    expenses.forEach((e) => {
      if (e.category) {
        map.set(e.category, e.category_label || e.category);
      }
    });
    return Array.from(map.entries()); // [key, label]
  }, [expenses]);

  // Category breakdown with percentages
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; total: number }>();
    expenses.forEach((e) => {
      const key = e.category || 'other';
      const label = e.category_label || 'Autre';
      const existing = map.get(key) || { label, total: 0 };
      existing.total += parseFloat(e.amount);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({
        key,
        label: val.label,
        total: val.total,
        percentage: totalExpenses > 0 ? (val.total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, totalExpenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (!selectedCategory) return expenses;
    return expenses.filter((e) => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  // Group filtered expenses by month
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    const sorted = [...filteredExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    sorted.forEach((e) => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const arr = groups.get(key) || [];
      arr.push(e);
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
  }, [filteredExpenses]);

  const formatMonthHeader = (key: string) => {
    const [year, month] = key.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // Colors for breakdown bar
  const barColors = [
    'bg-primary', 'bg-success', 'bg-warning', 'bg-secondary',
    'bg-danger', 'bg-primary/60', 'bg-success/60', 'bg-warning/60',
  ];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold text-foreground">Dépenses du label</h1>
            <p className="text-xs text-secondary-500">Investissements sur vos projets</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-warning/80 to-warning/60 rounded-3xl p-6 text-white">
          <p className="text-white/70 text-sm font-medium mb-1">Total des dépenses</p>
          <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
          <p className="text-white/70 text-sm mt-2">
            {expenses.length} dépense{expenses.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Category breakdown */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-background border border-divider rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Répartition par catégorie</p>
            {/* Stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden">
              {categoryBreakdown.map((cat, i) => (
                <div
                  key={cat.key}
                  className={`${barColors[i % barColors.length]} transition-all`}
                  style={{ width: `${cat.percentage}%` }}
                  title={`${cat.label}: ${cat.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="space-y-1.5">
              {categoryBreakdown.map((cat, i) => (
                <div key={cat.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${barColors[i % barColors.length]}`} />
                    <span className="text-foreground">
                      {getCategoryEmoji(cat.key)} {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-secondary-500 text-xs">{cat.percentage.toFixed(0)}%</span>
                    <span className="font-medium text-foreground">{formatCurrency(cat.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category filter pills */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === null
                  ? 'bg-foreground text-background'
                  : 'bg-content2 text-secondary-600 hover:bg-content3'
              }`}
            >
              Toutes
            </button>
            {categories.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === key
                    ? 'bg-foreground text-background'
                    : 'bg-content2 text-secondary-600 hover:bg-content3'
                }`}
              >
                {getCategoryEmoji(key)} {label}
              </button>
            ))}
          </div>
        )}

        {/* Expenses grouped by month */}
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🧾</span>
            </div>
            <p className="text-secondary-500">Aucune dépense enregistrée</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByMonth.map(([monthKey, items]) => (
              <div key={monthKey} className="space-y-2">
                <h3 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide">
                  {formatMonthHeader(monthKey)}
                </h3>
                <div className="space-y-2">
                  {items.map((expense) => (
                    <div
                      key={expense.id}
                      className="bg-background border border-divider rounded-2xl p-3 flex items-center gap-3"
                    >
                      {/* Category emoji */}
                      <div className="w-10 h-10 rounded-xl bg-content2 flex items-center justify-center text-lg shrink-0">
                        {getCategoryEmoji(expense.category)}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {expense.category_label || 'Autre'}
                          </span>
                          {expense.scope_title && (
                            <span className="px-2 py-0.5 bg-secondary/10 text-secondary-500 text-[11px] rounded-full truncate">
                              {expense.scope_title}
                            </span>
                          )}
                        </div>
                        {expense.description && (
                          <p className="text-xs text-secondary-500 truncate mt-0.5">{expense.description}</p>
                        )}
                        <p className="text-[11px] text-secondary-400 mt-0.5">{formatDate(expense.date)}</p>
                      </div>
                      {/* Amount */}
                      <p className="font-semibold text-danger text-sm shrink-0">
                        -{formatCurrency(parseFloat(expense.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
