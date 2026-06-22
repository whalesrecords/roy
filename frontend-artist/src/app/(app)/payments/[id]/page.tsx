'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getStatementDetail, getLabelSettings, StatementDetail, LabelSettings } from '@/lib/api';
import { Card, Eyebrow, Pill, fmtMoney } from '@/components/roy/ui';
import { IconChevronLeft, IconMusic, IconChart } from '@/components/roy/icons';

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
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return fmtMoney(value, currency);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Pill tone="accent">Paid</Pill>;
      case 'finalized':
        return <Pill tone="accent">Finalized</Pill>;
      default:
        return <Pill tone="neutral">Draft</Pill>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="min-h-screen bg-app">
        <header className="sticky top-0 z-50 bg-app/80 backdrop-blur-md border-b border-line lg:hidden">
          <div className="px-4 py-3 flex items-center gap-3">
            <Link href="/payments" className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors text-ink">
              <IconChevronLeft size={20} />
            </Link>
            <h1 className="font-semibold text-ink">Statement</h1>
          </div>
        </header>
        <main className="px-4 py-8 lg:px-7 lg:py-6 max-w-lg lg:max-w-none mx-auto">
          <div className="text-center text-neg text-sm">{error || 'Statement not found'}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 bg-app/80 backdrop-blur-md border-b border-line lg:hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/payments" className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors text-ink">
            <IconChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-ink truncate">Statement {statement.period_label}</h1>
            <p className="text-[11px] text-ink-faint">{formatDate(statement.created_at)}</p>
          </div>
          {getStatusBadge(statement.status)}
        </div>
      </header>

      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div className="flex items-center gap-4">
          <Link href="/payments" className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors text-ink-muted">
            <IconChevronLeft size={20} />
          </Link>
          <div>
            <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Statement {statement.period_label}</div>
            <div className="text-[12.5px] text-ink-faint mt-0.5">{formatDate(statement.created_at)}</div>
          </div>
        </div>
        {getStatusBadge(statement.status)}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {/* Hero — net payable */}
        <Card hero className="rounded-[20px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow>Net payable</Eyebrow>
              <div className="roy-num text-[44px] font-bold text-ink leading-none mt-2">
                {formatCurrency(statement.net_payable, statement.currency)}
              </div>
              <div className="text-[12px] text-ink-faint mt-2.5">
                {formatDate(statement.period_start)} – {formatDate(statement.period_end)}
              </div>
            </div>
            {getStatusBadge(statement.status)}
          </div>

          {labelSettings?.label_name && (
            <div className="flex items-center gap-2.5 mt-4 pt-4 border-t border-line">
              <img
                src={labelSettings.logo_base64 || labelSettings.logo_url || '/icon.svg'}
                alt={labelSettings.label_name}
                className="h-7 w-auto object-contain"
              />
              <span className="text-[12.5px] font-semibold text-ink-muted">{labelSettings.label_name}</span>
            </div>
          )}
        </Card>

        {/* Summary breakdown */}
        <Card>
          <Eyebrow className="text-[9.5px]">Summary</Eyebrow>
          <div className="mt-3 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] text-ink-muted">Gross revenue</span>
              <span className="roy-num text-[13.5px] font-semibold text-ink">{formatCurrency(statement.gross_revenue, statement.currency)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] text-ink-muted">Your royalties</span>
              <span className="roy-num text-[13.5px] font-semibold text-ink">{formatCurrency(statement.artist_royalties, statement.currency)}</span>
            </div>
            {parseFloat(statement.advance_balance) > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-ink-muted">Advance balance</span>
                <span className="roy-num text-[13.5px] font-semibold text-neg">{formatCurrency(statement.advance_balance, statement.currency)}</span>
              </div>
            )}
            {parseFloat(statement.recouped) > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-ink-muted">Advances recouped</span>
                <span className="roy-num text-[13.5px] font-semibold text-neg">-{formatCurrency(statement.recouped, statement.currency)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-3 border-t border-line">
              <span className="text-[13.5px] font-semibold text-ink">Net payable</span>
              <span className="roy-num text-[18px] font-bold text-accent">{formatCurrency(statement.net_payable, statement.currency)}</span>
            </div>
          </div>
        </Card>

        {/* Releases breakdown */}
        {statement.releases && statement.releases.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 text-ink">
              <IconMusic size={16} className="text-accent" />
              <Eyebrow className="text-[9.5px]">By album</Eyebrow>
            </div>
            <div className="mt-3 space-y-1.5">
              {statement.releases.map((release, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 bg-surface-2 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{release.title}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{release.track_count} track{release.track_count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="roy-num text-[13px] font-semibold text-ink">{formatCurrency(release.artist_royalties, statement.currency)}</p>
                    <p className="roy-num text-[11px] text-ink-faint mt-0.5">of {formatCurrency(release.gross, statement.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Sources breakdown */}
        {statement.sources && statement.sources.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 text-ink">
              <IconChart size={16} className="text-accent" />
              <Eyebrow className="text-[9.5px]">By platform</Eyebrow>
            </div>
            <div className="mt-3 space-y-1.5">
              {statement.sources.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 bg-surface-2 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink">{source.source_label}</p>
                    <p className="text-[11px] text-ink-faint mt-0.5">{source.transaction_count} transaction{source.transaction_count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="roy-num text-[13px] font-semibold text-ink">{formatCurrency(source.artist_royalties, statement.currency)}</p>
                    <p className="roy-num text-[11px] text-ink-faint mt-0.5">of {formatCurrency(source.gross, statement.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
