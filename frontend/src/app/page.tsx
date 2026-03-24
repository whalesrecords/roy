'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spinner } from '@heroui/react';
import { useAuth } from '@/contexts/AuthContext';
import { getArtists, getImports, getRoyaltyRuns, getTicketStats } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    artists: 0,
    imports: 0,
    pendingRuns: 0,
    openTickets: 0,
    totalRevenue: '0',
  });
  const [recentImports, setRecentImports] = useState<{ id: string; source: string; period_start: string; period_end: string; total_rows: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const [artists, imports, runs, tickets] = await Promise.all([
        getArtists(),
        getImports(),
        getRoyaltyRuns(),
        getTicketStats().catch(() => ({ open: 0 })),
      ]);

      const pendingRuns = runs.filter(r => r.status === 'draft' || r.status === 'completed').length;
      const totalRevenue = imports.reduce((sum, imp) => sum + (imp.total_rows || 0), 0);

      setStats({
        artists: artists.filter(a => a.category === 'signed').length,
        imports: imports.length,
        pendingRuns,
        openTickets: tickets.open,
        totalRevenue: totalRevenue.toLocaleString('fr-FR'),
      });
      setRecentImports(imports.slice(0, 5));
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" color="primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-default-500 mt-1">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/artists" className="bg-background rounded-2xl p-4 border border-divider hover:border-primary/30 transition-colors">
          <p className="text-xs font-medium text-default-500 uppercase tracking-wider">Artistes signés</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.artists}</p>
        </Link>
        <Link href="/imports" className="bg-background rounded-2xl p-4 border border-divider hover:border-primary/30 transition-colors">
          <p className="text-xs font-medium text-default-500 uppercase tracking-wider">Imports</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.imports}</p>
        </Link>
        <Link href="/royalties" className="bg-background rounded-2xl p-4 border border-divider hover:border-primary/30 transition-colors">
          <p className="text-xs font-medium text-default-500 uppercase tracking-wider">Calculs en attente</p>
          <p className="text-2xl font-bold text-warning mt-1">{stats.pendingRuns}</p>
        </Link>
        <Link href="/tickets" className="bg-background rounded-2xl p-4 border border-divider hover:border-primary/30 transition-colors">
          <p className="text-xs font-medium text-default-500 uppercase tracking-wider">Tickets ouverts</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.openTickets}</p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-background rounded-2xl p-5 border border-divider">
        <h2 className="text-sm font-semibold text-foreground mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/imports"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importer des revenus
          </Link>
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-default-100 text-foreground rounded-full text-sm font-medium hover:bg-default-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau contrat
          </Link>
          <Link
            href="/royalties"
            className="inline-flex items-center gap-2 px-4 py-2 bg-default-100 text-foreground rounded-full text-sm font-medium hover:bg-default-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Calculer royalties
          </Link>
        </div>
      </div>

      {/* Recent Imports */}
      {recentImports.length > 0 && (
        <div className="bg-background rounded-2xl p-5 border border-divider">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Derniers imports</h2>
            <Link href="/imports" className="text-xs text-primary hover:underline">Tout voir</Link>
          </div>
          <div className="space-y-2">
            {recentImports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{imp.source}</p>
                  <p className="text-xs text-default-500">{imp.period_start} → {imp.period_end}</p>
                </div>
                <span className="text-xs text-default-500">{imp.total_rows?.toLocaleString('fr-FR')} lignes</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
