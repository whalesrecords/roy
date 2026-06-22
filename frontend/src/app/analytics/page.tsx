'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getAnalyticsSummary, AnalyticsSummary } from '@/lib/api';
import { Card, Kpi } from '@/components/roy/ui';
import { IconChevronRight } from '@/components/roy/icons';

const COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#00C7F2', '#8b5cf6', '#f97316', '#ec4899'];

interface ChartData {
  month: string;
  revenue: number;
  expenses: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await getAnalyticsSummary(parseInt(selectedYear));
      setData(summary);
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

  // Prepare chart data
  const monthlyChartData: ChartData[] = [];
  if (data) {
    // Create a map for all 12 months
    const monthData: Record<number, { revenue: number; expenses: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthData[m] = { revenue: 0, expenses: 0 };
    }

    // Fill with revenue
    data.monthly_revenue.forEach((mr) => {
      monthData[mr.month].revenue = parseFloat(mr.gross);
    });

    // Fill with expenses
    data.monthly_expenses.forEach((me) => {
      monthData[me.month].expenses = parseFloat(me.amount);
    });

    const monthLabels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 1; m <= 12; m++) {
      monthlyChartData.push({
        month: monthLabels[m - 1],
        revenue: monthData[m].revenue,
        expenses: monthData[m].expenses,
      });
    }
  }

  // Revenue by source pie data
  const revenueBySourceData = data?.revenue_by_source.map((s) => ({
    name: s.source_label,
    value: parseFloat(s.gross),
  })) || [];

  // Expenses by category pie data
  const expensesByCategoryData = data?.expenses_by_category.map((c) => ({
    name: c.category_label,
    value: parseFloat(c.amount),
  })) || [];

  const totalRevenue = data ? parseFloat(data.total_revenue) : 0;
  const totalExpenses = data ? parseFloat(data.total_expenses) : 0;
  const totalRoyaltiesPayable = data ? parseFloat(data.total_royalties_payable) : 0;
  const totalOutflow = data ? parseFloat(data.total_outflow) : 0;
  const net = data ? parseFloat(data.net) : 0;

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
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Analytics</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Whales Records · vue d'ensemble financière {selectedYear}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 rounded-[10px] border border-line bg-surface p-1">
            {years.slice(0, 4).map((y) => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-[7px] text-[12px] font-${y === selectedYear ? 'semibold' : 'medium'} ${y === selectedYear ? 'bg-ink text-app' : 'text-ink-muted hover:text-ink'}`}>
                {y}
              </button>
            ))}
          </div>
          <Link href="/analytics/streaming"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-surface-2 transition-colors">
            Streaming &amp; Social <IconChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <Kpi label="Recettes" value={formatCurrency(totalRevenue)} accentValue />
          <Kpi label="Avances / Frais" value={formatCurrency(totalExpenses)} />
          <Kpi label="Royalties artistes" value={formatCurrency(totalRoyaltiesPayable)} />
          <Kpi label="Total sorties" value={formatCurrency(totalOutflow)} />
          <div className="col-span-2 sm:col-span-1">
            <Kpi
              label="Résultat net"
              value={formatCurrency(net)}
              hero
              accentValue={net >= 0}
            />
          </div>
        </div>

        {/* Monthly Revenue vs Expenses Chart */}
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-semibold text-ink">Recettes vs Sorties par mois</span>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-ink-muted"><span className="w-1.5 h-1.5 rounded-full bg-accent" />Recettes</span>
              <span className="flex items-center gap-1.5 text-[11px] text-ink-muted"><span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />Sorties</span>
            </div>
          </div>
          {monthlyChartData.some((d) => d.revenue > 0 || d.expenses > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyChartData} margin={{ top: 12, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--text-3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                />
                <Bar dataKey="revenue" name="Recettes" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Sorties" fill="var(--text-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-ink-faint text-[13px]">
              Aucune donnée pour {selectedYear}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Revenue by Source */}
          <Card>
            <span className="text-[13.5px] font-semibold text-ink">Recettes par source</span>
            {revenueBySourceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={revenueBySourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {revenueBySourceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2.5">
                  {data?.revenue_by_source.map((source, idx) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] text-ink">
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {source.source_label}
                      </span>
                      <span className="roy-num text-[13px] font-semibold text-ink">{formatCurrency(source.gross)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-ink-faint text-[13px]">
                Aucune recette pour {selectedYear}
              </div>
            )}
          </Card>

          {/* Expenses by Category */}
          <Card>
            <span className="text-[13.5px] font-semibold text-ink">Sorties par catégorie</span>
            {expensesByCategoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expensesByCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {expensesByCategoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2.5">
                  {data?.expenses_by_category.map((cat, idx) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] text-ink">
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        {cat.category_label}
                      </span>
                      <span className="roy-num text-[13px] font-semibold text-ink">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-ink-faint text-[13px]">
                Aucune sortie enregistrée pour {selectedYear}
              </div>
            )}
          </Card>
        </div>

        {/* Detailed Tables */}
        {data && data.revenue_by_source.length > 0 && (
          <Card padded={false} className="overflow-hidden">
            <div className="px-[22px] py-4 border-b border-line text-[13.5px] font-semibold text-ink">Détail des recettes par source</div>
            <div>
              {data.revenue_by_source.map((source, idx) => (
                <div key={source.source} className="flex items-center justify-between px-[22px] py-3.5 border-b border-line last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{source.source_label}</p>
                      <p className="text-[11px] text-ink-faint mt-0.5">
                        {source.transaction_count.toLocaleString('fr-FR')} transactions
                      </p>
                    </div>
                  </div>
                  <p className="roy-num text-[13px] font-bold text-accent">{formatCurrency(source.gross)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {data && data.expenses_by_category.length > 0 && (
          <Card padded={false} className="overflow-hidden">
            <div className="px-[22px] py-4 border-b border-line text-[13.5px] font-semibold text-ink">Détail des sorties par catégorie</div>
            <div>
              {data.expenses_by_category.map((cat, idx) => (
                <div key={cat.category} className="flex items-center justify-between px-[22px] py-3.5 border-b border-line last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{cat.category_label}</p>
                      <p className="text-[11px] text-ink-faint mt-0.5">
                        {cat.count} entrée{cat.count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="roy-num text-[13px] font-bold text-ink">{formatCurrency(cat.amount)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
