'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistPayments, getStatements, requestPayment, ArtistPayment, Statement } from '@/lib/api';

export default function PaymentsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'statements' | 'payments'>('statements');
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (artist) {
      loadData();
    }
  }, [artist]);

  const loadData = async () => {
    try {
      const [paymentsData, statementsData] = await Promise.all([
        getArtistPayments(),
        getStatements(),
      ]);
      setPayments(paymentsData);
      setStatements(statementsData);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded-full">Paid</span>;
      case 'finalized':
        return <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">Finalized</span>;
      default:
        return <span className="px-2 py-0.5 bg-secondary/10 text-secondary-600 text-xs font-medium rounded-full">Draft</span>;
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  // Only count unpaid statements (finalized but not paid)
  const unpaidStatements = statements.filter(s => s.status !== 'paid');
  const totalPayable = unpaidStatements.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);

  const handleRequestPayment = async (statementId: string) => {
    setRequestingPayment(true);
    setError(null);
    try {
      await requestPayment(statementId);
      setPaymentSuccess('Payment request sent successfully!');
      setTimeout(() => setPaymentSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error during request');
    } finally {
      setRequestingPayment(false);
    }
  };

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
            <p className="text-xs text-secondary-500">Statements and disbursements</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-4">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {paymentSuccess && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-2xl">
            <p className="text-success text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {paymentSuccess}
            </p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-4 text-white">
            <p className="text-white/70 text-xs mb-1">Royalties due</p>
            <p className="text-xl font-bold">{formatCurrency(totalPayable.toString())}</p>
          </div>
          <div className="bg-gradient-to-br from-success to-success/80 rounded-2xl p-4 text-white">
            <p className="text-white/70 text-xs mb-1">Total paid</p>
            <p className="text-xl font-bold">{formatCurrency(totalPaid.toString())}</p>
          </div>
        </div>

        {/* Request Payment Button */}
        {totalPayable > 0 && (
          <button
            onClick={() => unpaidStatements.length > 0 && handleRequestPayment(unpaidStatements[0].id)}
            disabled={requestingPayment || unpaidStatements.length === 0}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {requestingPayment ? (
              <>
                <Spinner size="sm" color="white" />
                Sending...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Request Payment ({formatCurrency(totalPayable.toString())})
              </>
            )}
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-content2 rounded-xl">
          <button
            onClick={() => setActiveTab('statements')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'statements'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-secondary-500'
            }`}
          >
            Statements ({statements.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'payments'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-secondary-500'
            }`}
          >
            Disbursements ({payments.length})
          </button>
        </div>

        {/* Statements Tab */}
        {activeTab === 'statements' && (
          <div className="space-y-3">
            {statements.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-secondary-500">No statements available</p>
                <p className="text-xs text-secondary-400 mt-1">Statements will be generated by your label</p>
              </div>
            ) : (
              statements.map((stmt) => (
                <Link
                  key={stmt.id}
                  href={`/payments/${stmt.id}`}
                  className="block bg-background border border-divider rounded-2xl p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{stmt.period_label}</p>
                      <p className="text-xs text-secondary-500">{formatDate(stmt.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(stmt.status)}
                      <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Gross revenue</span>
                      <span className="text-foreground">{formatCurrency(stmt.gross_revenue, stmt.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Your royalties</span>
                      <span className="text-foreground">{formatCurrency(stmt.artist_royalties, stmt.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-500">Advances recouped</span>
                      <span className="text-warning">-{formatCurrency(stmt.recouped, stmt.currency)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-divider">
                      <span className="font-semibold text-foreground">Net payable</span>
                      <span className="font-bold text-success text-lg">{formatCurrency(stmt.net_payable, stmt.currency)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-content2 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-secondary-500">No disbursements yet</p>
              </div>
            ) : (
              payments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-background border border-divider rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">Disbursement</p>
                    {payment.description && (
                      <p className="text-sm text-secondary-500 truncate">{payment.description}</p>
                    )}
                    <p className="text-xs text-secondary-400">{formatDate(payment.date)}</p>
                  </div>
                  <p className="font-bold text-success text-lg">{formatCurrency(payment.amount, payment.currency)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
