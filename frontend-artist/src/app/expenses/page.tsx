'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getExpenses, Expense } from '@/lib/api';
import BottomNav from '@/components/layout/BottomNav';

export default function ExpensesPage() {
  const { artist, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'catalog': return 'Catalog';
      case 'release': return 'Album';
      case 'track': return 'Track';
      default: return scope;
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

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
            <h1 className="font-semibold text-foreground">Label Expenses</h1>
            <p className="text-xs text-secondary-500">Investments on your projects</p>
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
          <p className="text-white/70 text-sm font-medium mb-1">Total expenses</p>
          <p className="text-3xl font-bold">{formatCurrency(totalExpenses.toString())}</p>
          <p className="text-white/70 text-sm mt-2">{expenses.length} expense{expenses.length > 1 ? 's' : ''}</p>
        </div>

        {/* Expenses List */}
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <p className="text-secondary-500">No expenses on file</p>
            </div>
          ) : (
            expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-background border border-divider rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {expense.category_label && (
                        <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded-full">
                          {expense.category_label}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary-600 text-xs rounded-full">
                        {getScopeLabel(expense.scope)}
                        {expense.scope_title && `: ${expense.scope_title}`}
                      </span>
                    </div>
                    {expense.description && (
                      <p className="text-sm text-foreground">{expense.description}</p>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(expense.amount, expense.currency)}
                  </p>
                </div>
                <p className="text-xs text-secondary-500">{formatDate(expense.date)}</p>
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
