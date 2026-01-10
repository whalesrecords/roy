'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getStatementDetail, getLabelSettings, StatementDetail, LabelSettings } from '@/lib/api';

export default function StatementDetailPage() {
  const { artist, loading: authLoading } = useAuth();
  const params = useParams();
  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist && params.id) {
      loadData();
    }
  }, [artist, params.id]);

  const loadData = async () => {
    try {
      const [statementData, settingsData] = await Promise.all([
        getStatementDetail(params.id as string),
        getLabelSettings(),
      ]);
      setStatement(statementData);
      setLabelSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-full">Payé</span>;
      case 'finalized':
        return <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">Finalisé</span>;
      default:
        return <span className="px-3 py-1 bg-secondary/10 text-secondary-600 text-sm font-medium rounded-full">Brouillon</span>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="min-h-screen bg-background safe-top safe-bottom">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
          <div className="px-4 py-3 flex items-center gap-3">
            <Link href="/payments" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="font-semibold text-foreground">Relevé</h1>
          </div>
        </header>
        <main className="px-4 py-8">
          <div className="text-center">
            <p className="text-danger">{error || 'Relevé non trouvé'}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/payments" className="p-2 -ml-2 rounded-full hover:bg-content2 transition-colors">
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">Relevé {statement.period_label}</h1>
            <p className="text-xs text-secondary-500">{formatDate(statement.created_at)}</p>
          </div>
          {getStatusBadge(statement.status)}
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-4">
        {/* Label Info */}
        {labelSettings?.label_name && (
          <div className="flex items-center gap-3 p-3 bg-content2 rounded-xl">
            {labelSettings.label_logo_url && (
              <img
                src={labelSettings.label_logo_url}
                alt={labelSettings.label_name}
                className="h-10 w-auto object-contain"
              />
            )}
            <span className="font-medium text-foreground">{labelSettings.label_name}</span>
          </div>
        )}

        {/* Period */}
        <div className="bg-content2 rounded-xl p-3 text-center">
          <p className="text-sm text-secondary-500">Période</p>
          <p className="font-medium text-foreground">
            {formatDate(statement.period_start)} - {formatDate(statement.period_end)}
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-primary/10 to-success/10 rounded-2xl p-4 border border-primary/20">
          <h2 className="font-semibold text-foreground mb-3">Résumé</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-secondary-600">Revenus bruts</span>
              <span className="font-medium text-foreground">{formatCurrency(statement.gross_revenue, statement.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">Vos royalties</span>
              <span className="font-medium text-foreground">{formatCurrency(statement.artist_royalties, statement.currency)}</span>
            </div>
            {parseFloat(statement.advance_balance) > 0 && (
              <div className="flex justify-between">
                <span className="text-secondary-600">Solde avance</span>
                <span className="font-medium text-warning">{formatCurrency(statement.advance_balance, statement.currency)}</span>
              </div>
            )}
            {parseFloat(statement.recouped) > 0 && (
              <div className="flex justify-between">
                <span className="text-secondary-600">Avances récupérées</span>
                <span className="font-medium text-warning">-{formatCurrency(statement.recouped, statement.currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-divider">
              <span className="font-semibold text-foreground">Net à percevoir</span>
              <span className="font-bold text-success text-xl">{formatCurrency(statement.net_payable, statement.currency)}</span>
            </div>
          </div>
        </div>

        {/* Releases Breakdown */}
        {statement.releases && statement.releases.length > 0 && (
          <div className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Par album
            </h2>
            <div className="space-y-3">
              {statement.releases.map((release, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{release.title}</p>
                    <p className="text-xs text-secondary-500">{release.track_count} titre{release.track_count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-medium text-foreground">{formatCurrency(release.artist_royalties, statement.currency)}</p>
                    <p className="text-xs text-secondary-500">sur {formatCurrency(release.gross, statement.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources Breakdown */}
        {statement.sources && statement.sources.length > 0 && (
          <div className="bg-background border border-divider rounded-2xl p-4">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Par plateforme
            </h2>
            <div className="space-y-3">
              {statement.sources.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{source.source_label}</p>
                    <p className="text-xs text-secondary-500">{source.transaction_count} transaction{source.transaction_count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="font-medium text-foreground">{formatCurrency(source.artist_royalties, statement.currency)}</p>
                    <p className="text-xs text-secondary-500">sur {formatCurrency(source.gross, statement.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-divider safe-bottom">
        <div className="flex items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Accueil</span>
          </Link>
          <Link href="/releases" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-medium">Releases</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 px-4 py-2 text-secondary-500 hover:text-primary transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium">Stats</span>
          </Link>
          <Link href="/payments" className="flex flex-col items-center gap-1 px-4 py-2 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs font-medium">Paiements</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
