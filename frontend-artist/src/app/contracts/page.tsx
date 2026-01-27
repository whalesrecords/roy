'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getContracts, Contract } from '@/lib/api';

export default function ContractsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadContracts();
    }
  }, [artist]);

  const loadContracts = async () => {
    try {
      const data = await getContracts();
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
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
      case 'catalog': return 'Full catalog';
      case 'release': return 'Album';
      case 'track': return 'Track';
      default: return scope;
    }
  };

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
            <h1 className="font-semibold text-foreground">My Contracts</h1>
            <p className="text-xs text-secondary-500">Revenue sharing agreements</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-4">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {contracts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-secondary-500">No contracts on file</p>
          </div>
        ) : (
          contracts.map((contract) => (
            <div
              key={contract.id}
              className="bg-background border border-divider rounded-2xl p-4"
            >
              {/* Scope Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  {getScopeLabel(contract.scope)}
                </span>
                {contract.scope_title && (
                  <span className="text-sm text-foreground font-medium">
                    {contract.scope_title}
                  </span>
                )}
              </div>

              {/* Shares */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-success/5 border border-success/20 rounded-xl p-3">
                  <p className="text-xs text-success font-medium mb-1">Artist Share</p>
                  <p className="text-2xl font-bold text-success">{contract.artist_share}%</p>
                </div>
                <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3">
                  <p className="text-xs text-secondary-600 font-medium mb-1">Label Share</p>
                  <p className="text-2xl font-bold text-secondary-600">{contract.label_share}%</p>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 text-sm text-secondary-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  {formatDate(contract.start_date)}
                  {' - '}
                  {contract.end_date ? formatDate(contract.end_date) : 'Unlimited'}
                </span>
              </div>

              {/* Description */}
              {contract.description && (
                <p className="mt-3 text-sm text-secondary-500 italic">
                  {contract.description}
                </p>
              )}
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
