'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistPayments, ArtistPayment } from '@/lib/api';

export default function PaymentsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadPayments();
    }
  }, [artist]);

  const loadPayments = async () => {
    try {
      const data = await getArtistPayments();
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number, currency: string = 'EUR') => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('en-US', { style: 'currency', currency });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Summary
  const totalReceived = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const currency = payments[0]?.currency || 'EUR';
  const lastPaymentDate = payments.length > 0
    ? payments.reduce((latest, p) => (p.date > latest ? p.date : latest), payments[0].date)
    : null;

  // Group by year, most recent first
  const groupedByYear = useMemo(() => {
    const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date));
    const groups: Record<string, ArtistPayment[]> = {};
    for (const p of sorted) {
      const year = new Date(p.date).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(p);
    }
    return Object.entries(groups).sort(([a], [b]) => parseInt(b) - parseInt(a));
  }, [payments]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
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
            <h1 className="font-semibold text-foreground">Payments</h1>
            <p className="text-xs text-secondary-500">Transaction history</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-5">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-success to-success/80 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-white/70 text-sm font-medium">Total received</span>
          </div>
          <p className="text-3xl font-bold mb-4">{formatCurrency(totalReceived, currency)}</p>
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-white/60 text-xs">Payments</p>
              <p className="font-semibold">{payments.length}</p>
            </div>
            {lastPaymentDate && (
              <div className="text-right">
                <p className="text-white/60 text-xs">Last payment</p>
                <p className="font-semibold">{formatDate(lastPaymentDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Link to statements */}
        <Link
          href="/payments"
          className="flex items-center justify-between px-4 py-3 bg-content1 rounded-xl border border-divider hover:border-primary/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-foreground">Voir mes relev&eacute;s</span>
          </div>
          <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Empty state */}
        {payments.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-foreground font-medium mb-1">Aucun paiement re&ccedil;u</p>
            <p className="text-xs text-secondary-400">Your payments will appear here once processed</p>
          </div>
        )}

        {/* Timeline grouped by year */}
        {groupedByYear.map(([year, yearPayments]) => (
          <div key={year}>
            {/* Year label */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">{year}</span>
              <div className="flex-1 border-t border-divider" />
            </div>

            {/* Payments in this year */}
            <div className="space-y-0">
              {yearPayments.map((payment, index) => (
                <div key={payment.id}>
                  <div className="flex items-center gap-3 py-3">
                    {/* Green checkmark */}
                    <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    {/* Description + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {payment.description || 'Payment'}
                      </p>
                      <p className="text-xs text-secondary-400">{formatDate(payment.date)}</p>
                    </div>

                    {/* Amount */}
                    <p className="text-lg font-bold text-success flex-shrink-0">
                      +{formatCurrency(payment.amount, payment.currency)}
                    </p>
                  </div>

                  {/* Separator */}
                  {index < yearPayments.length - 1 && (
                    <div className="border-b border-divider ml-13" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
