'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
} from '@heroui/react';
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
  Legend,
} from 'recharts';
import { getAnalyticsSummary, AnalyticsSummary } from '@/lib/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4'];

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
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <>
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Analytics</h1>
              <p className="text-secondary-500 text-sm mt-0.5">Vue d'ensemble financière</p>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 bg-content2 border-2 border-default-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="bg-danger-50">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Recettes</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Avances/Frais</p>
              <p className="text-2xl font-bold text-warning">{formatCurrency(totalExpenses)}</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Royalties artistes</p>
              <p className="text-2xl font-bold text-secondary">{formatCurrency(totalRoyaltiesPayable)}</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Total Sorties</p>
              <p className="text-2xl font-bold text-danger">{formatCurrency(totalOutflow)}</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm col-span-2 sm:col-span-1">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Resultat Net</p>
              <p className={`text-2xl font-bold ${net >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(net)}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Monthly Revenue vs Expenses Chart */}
        <Card className="border border-divider rounded-2xl shadow-sm">
          <CardHeader className="px-4 py-3 border-b border-divider">
            <h2 className="font-semibold text-foreground">Recettes vs Sorties par Mois</h2>
          </CardHeader>
          <CardBody className="p-4">
            {monthlyChartData.some((d) => d.revenue > 0 || d.expenses > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-default-200" />
                  <XAxis dataKey="month" className="text-default-500" />
                  <YAxis
                    className="text-default-500"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{
                      backgroundColor: 'var(--heroui-background)',
                      border: '1px solid var(--heroui-divider)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Recettes" fill="#17C964" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Sorties (avances + royalties)" fill="#F31260" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-default-500">
                Aucune donnee pour {selectedYear}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Source */}
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <h2 className="font-semibold text-foreground">Recettes par Source</h2>
            </CardHeader>
            <CardBody className="p-4">
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
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {revenueBySourceData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {data?.revenue_by_source.map((source, idx) => (
                      <div key={source.source} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-foreground">{source.source_label}</span>
                        </div>
                        <span className="font-medium text-foreground">{formatCurrency(source.gross)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-default-500">
                  Aucune recette pour {selectedYear}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Expenses by Category */}
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <h2 className="font-semibold text-foreground">Sorties par Categorie</h2>
            </CardHeader>
            <CardBody className="p-4">
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
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {expensesByCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {data?.expenses_by_category.map((cat, idx) => (
                      <div key={cat.category} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-foreground">{cat.category_label}</span>
                        </div>
                        <span className="font-medium text-foreground">{formatCurrency(cat.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-default-500">
                  Aucune sortie enregistree pour {selectedYear}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Detailed Tables */}
        {data && data.revenue_by_source.length > 0 && (
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <h2 className="font-semibold text-foreground">Detail des Recettes par Source</h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-divider">
                {data.revenue_by_source.map((source, idx) => (
                  <div key={source.source} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{source.source_label}</p>
                        <p className="text-sm text-default-500">
                          {source.transaction_count.toLocaleString('fr-FR')} transactions
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-success">{formatCurrency(source.gross)}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {data && data.expenses_by_category.length > 0 && (
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <h2 className="font-semibold text-foreground">Detail des Sorties par Categorie</h2>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-divider">
                {data.expenses_by_category.map((cat, idx) => (
                  <div key={cat.category} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <div>
                        <p className="font-medium text-foreground">{cat.category_label}</p>
                        <p className="text-sm text-default-500">
                          {cat.count} entree{cat.count > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-danger">{formatCurrency(cat.amount)}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
