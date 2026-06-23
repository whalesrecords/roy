'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getAnalyticsSummary, AnalyticsSummary } from '@/lib/api';
import { AdminBottomNav } from '@/components/roy/AdminBottomNav';
import { Eyebrow } from '@/components/roy/ui';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function MobileFinancesPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const summary = await getAnalyticsSummary(year);
        setData(summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const totalRevenue = data ? parseFloat(data.total_revenue) : 0;
  const totalExpenses = data ? parseFloat(data.total_expenses) : 0;
  const expensesByCategory = data?.expenses_by_category || [];
  const maxExpense = Math.max(0, ...expensesByCategory.map(c => parseFloat(c.amount)));

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="flex items-start justify-between py-2 mb-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
              Finances
            </h1>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Revenus, dépenses & marge
            </div>
          </div>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="rounded-[10px] border px-3 py-1.5 text-[12px] font-semibold bg-transparent"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-[11px]">
          <div
            className="rounded-[18px] border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Revenus</Eyebrow>
            <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>
              {fmtEUR(totalRevenue)}
            </div>
          </div>
          <div
            className="rounded-[18px] border p-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <Eyebrow>Dépenses</Eyebrow>
            <div className="roy-num text-[21px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>
              {fmtEUR(totalExpenses)}
            </div>
          </div>
        </div>

        {/* Expenses by category */}
        {expensesByCategory.length > 0 && (
          <div
            className="rounded-[20px] border p-[18px] mt-[11px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="text-[13.5px] font-semibold mb-[15px]" style={{ color: 'var(--text)' }}>
              Dépenses par catégorie
            </div>
            <div className="flex flex-col gap-[13px]">
              {expensesByCategory.map(cat => {
                const amount = parseFloat(cat.amount);
                const pct = maxExpense > 0 ? (amount / maxExpense) * 100 : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[12.5px]" style={{ color: 'var(--text)' }}>{cat.category_label}</span>
                      <span className="roy-num text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                        {fmtEUR(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--track)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: 'var(--accent)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent operations from monthly data */}
        {data && data.monthly_expenses.length > 0 && (
          <div
            className="rounded-[20px] border px-4 py-1.5 mt-[11px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <div className="text-[13.5px] font-semibold py-3 border-b" style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
              Dernières dépenses mensuelles
            </div>
            {data.monthly_expenses.slice(-5).reverse().map((m, i, arr) => (
              <div
                key={`${m.year}-${m.month}`}
                className={`flex items-center justify-between py-[13px] ${i < arr.length - 1 ? 'border-b' : ''}`}
                style={i < arr.length - 1 ? { borderColor: 'var(--border)' } : undefined}
              >
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                    {m.month_label} {m.year}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {Object.keys(m.category_breakdown).length} catégorie(s)
                  </div>
                </div>
                <span className="roy-num text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
                  −{fmtEUR(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminBottomNav />
    </div>
  );
}
