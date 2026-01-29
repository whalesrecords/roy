'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import NotificationBell from '@/components/layout/NotificationBell';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getArtistDashboard, getQuarterlyRevenue, getLabelSettings, getStatements, getMyTickets, ArtistDashboard, QuarterlyRevenue, LabelSettings, Statement, requestPayment } from '@/lib/api';

export default function DashboardPage() {
  const { artist, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [unreadTickets, setUnreadTickets] = useState(0);

  useEffect(() => {
    if (artist) {
      loadDashboard();
      loadUnreadTickets();
      // Auto-refresh unread tickets every 30 seconds
      const interval = setInterval(loadUnreadTickets, 30000);
      return () => clearInterval(interval);
    }
  }, [artist]);

  const loadDashboard = async () => {
    try {
      const [dashboard, quarterlyData, settings, statementsData] = await Promise.all([
        getArtistDashboard(),
        getQuarterlyRevenue(),
        getLabelSettings(),
        getStatements(),
      ]);
      setData(dashboard);
      setQuarterly(quarterlyData);
      setLabelSettings(settings);
      setStatements(statementsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadTickets = async () => {
    try {
      const tickets = await getMyTickets();
      const unreadCount = tickets.filter(t => t.unread_count > 0).length;
      setUnreadTickets(unreadCount);
    } catch (err) {
      // Silently fail for unread count
    }
  };

  // Get unpaid statements for payment request
  const unpaidStatements = statements.filter(s => s.status !== 'paid');
  const totalUnpaid = unpaidStatements.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);

  const handleRequestPayment = async () => {
    if (unpaidStatements.length === 0) return;

    setRequestingPayment(true);
    setError(null);
    try {
      // Request payment for the first unpaid statement
      await requestPayment(unpaidStatements[0].id);
      setPaymentSuccess('Payment request sent successfully!');
      setTimeout(() => setPaymentSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error during request');
    } finally {
      setRequestingPayment(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString('en-US');
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
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Label Logo */}
            {(labelSettings?.logo_base64 || labelSettings?.logo_url) ? (
              <img
                src={labelSettings.logo_base64 || labelSettings.logo_url}
                alt={labelSettings.label_name || 'Label'}
                className="h-10 w-auto max-w-[120px] object-contain"
              />
            ) : data?.artist.artwork_url ? (
              <img
                src={data.artist.artwork_url}
                alt={artist.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{artist.name}</p>
              <p className="text-xs text-secondary-500">{labelSettings?.label_name || 'Artist Portal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-content2 hover:bg-content3 transition-colors"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-full bg-content2 hover:bg-danger/10 hover:text-danger transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
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

        {/* Main Balance Card */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-white shadow-xl shadow-primary/30">
          <p className="text-white/70 text-sm font-medium mb-1">Available Balance</p>
          <p className="text-4xl font-bold mb-4">
            {data ? formatCurrency(data.total_net, data.currency) : '—'}
          </p>
          <div className="flex items-center gap-4 text-sm mb-4">
            <div>
              <p className="text-white/70">Gross Revenue</p>
              <p className="font-semibold">{data ? formatCurrency(data.total_gross, data.currency) : '—'}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-white/70">Advances</p>
              <p className="font-semibold">{data ? formatCurrency(data.advance_balance, data.currency) : '—'}</p>
            </div>
          </div>
          {/* Request Payment Button */}
          {totalUnpaid > 0 && (
            <button
              onClick={handleRequestPayment}
              disabled={requestingPayment}
              className="w-full bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
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
                  Request Payment
                </>
              )}
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(data?.total_streams || 0)}</p>
            <p className="text-sm text-secondary-500">Total Streams</p>
          </div>

          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.release_count || 0}</p>
            <p className="text-sm text-secondary-500">Releases</p>
          </div>

          <div className="bg-background border border-divider rounded-2xl p-4">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-foreground">{data?.track_count || 0}</p>
            <p className="text-sm text-secondary-500">Tracks</p>
          </div>

          <Link href="/stats" className="bg-background border border-divider rounded-2xl p-4 hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground">View stats</p>
            <p className="text-xs text-secondary-500">By platform</p>
          </Link>
        </div>

        {/* Quarterly Revenue */}
        {quarterly.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide px-1">
              Revenue by Quarter
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quarterly.map((q) => (
                <div key={q.quarter} className="bg-background border border-divider rounded-2xl p-4">
                  <p className="text-sm text-secondary-500 mb-1">{q.quarter} {q.year}</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(q.gross, q.currency)}</p>
                  <p className="text-xs text-success">{formatNumber(q.streams)} streams</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-secondary-500 uppercase tracking-wide px-1">
            Details
          </h2>

          <Link
            href="/releases"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">My Releases</p>
              <p className="text-sm text-secondary-500">Revenue by album</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/tracks"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">My Tracks</p>
              <p className="text-sm text-secondary-500">Revenue by track</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/payments"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Payments</p>
              <p className="text-sm text-secondary-500">Payment history</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/expenses"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-danger/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Label Expenses</p>
              <p className="text-sm text-secondary-500">Investments on your projects</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/contracts"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
          >
            <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">My Contracts</p>
              <p className="text-sm text-secondary-500">Revenue sharing agreements</p>
            </div>
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/support"
            className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors relative"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Support</p>
              <p className="text-sm text-secondary-500">Get help from the label</p>
            </div>
            {unreadTickets > 0 && (
              <span className="absolute top-2 right-2 px-2 py-0.5 bg-danger text-white text-xs font-bold rounded-full">
                {unreadTickets}
              </span>
            )}
            <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* App Logo */}
        <div className="flex justify-center pt-4">
          <img
            src="/icon.svg"
            alt="Artist Portal"
            className="h-12 object-contain opacity-50"
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
