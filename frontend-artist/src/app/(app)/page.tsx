'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getArtistDashboard,
  getQuarterlyRevenue,
  getAvailableYears,
  getStatements,
  getArtistTracks,
  getArtistPayments,
  requestPayment,
  ArtistDashboard,
  QuarterlyRevenue,
  Statement,
  ArtistTrack,
  ArtistPayment,
} from '@/lib/api';
import { Card, Eyebrow, Sparkline, AccentButton, fmtMoney, fmtNum } from '@/components/roy/ui';
import {
  IconBell, IconArrowDown, IconFile, IconInflow, IconOutflow,
  IconMusic, IconChevronRight,
} from '@/components/roy/icons';

interface Activity {
  id: string;
  label: string;
  sub: string;
  amount: number;
  inflow: boolean;
  date: number;
}

export default function DashboardPage() {
  const { artist, loading: authLoading } = useAuth();

  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!artist) return;
    let cancelled = false;
    (async () => {
      try {
        const [dashboard, stmts] = await Promise.all([getArtistDashboard(), getStatements()]);
        if (cancelled) return;
        setData(dashboard);
        setStatements(stmts);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artist]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        const [years, t, p] = await Promise.all([getAvailableYears(), getArtistTracks(), getArtistPayments()]);
        if (cancelled) return;
        const q = years.default_year ? await getQuarterlyRevenue(years.default_year) : [];
        setQuarterly(q.filter((x) => parseFloat(x.gross) > 0));
        setTracks(t);
        setPayments(p);
      } catch { /* non-critique */ }
    })();
    return () => { cancelled = true; };
  }, [data]);

  const currency = data?.currency || 'EUR';
  const unpaid = statements.filter((s) => s.status !== 'paid');
  const available = unpaid
    .filter((s) => s.status === 'approved' || s.status === 'ready' || s.status === 'pending_payment')
    .reduce((sum, s) => sum + parseFloat(s.net_payable), 0);
  const totalUnpaid = unpaid.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);
  const pendingValidation = Math.max(totalUnpaid - available, 0);
  const displayAvailable = available || totalUnpaid;

  const handleRequest = async () => {
    if (!unpaid.length) return;
    setRequesting(true);
    try {
      await requestPayment(unpaid[0].id);
      setPaymentSuccess('Demande de versement envoyée !');
      setTimeout(() => setPaymentSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setRequesting(false);
    }
  };

  const firstName = artist?.name?.split(' ')[0] || '';
  const initials = artist?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '';
  const today = new Date();
  const dateLong = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dateFull = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Activity feed — statements (inflows) + payments (outflows)
  const activity: Activity[] = [
    ...statements.slice(0, 5).map((s) => ({
      id: `s-${s.id}`,
      label: `Relevé · ${s.period_label}`,
      sub: `Royalties · ${new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
      amount: parseFloat(s.net_payable),
      inflow: true,
      date: new Date(s.created_at).getTime(),
    })),
    ...payments.slice(0, 5).map((p) => ({
      id: `p-${p.id}`,
      label: p.description || 'Versement SEPA',
      sub: `Virement · ${new Date(p.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      amount: parseFloat(p.amount),
      inflow: false,
      date: new Date(p.date).getTime(),
    })),
  ].sort((a, b) => b.date - a.date).slice(0, 5);

  const topTracks = [...tracks].sort((a, b) => b.streams - a.streams).slice(0, 3);
  const sparkPoints = quarterly.map((q) => parseFloat(q.gross));

  if (!artist && !authLoading) return null;

  const bell = (
    <button className="relative flex items-center justify-center w-10 h-10 rounded-[11px] border border-line bg-surface text-ink hover:bg-surface-2 transition-colors">
      <IconBell size={18} />
      <span className="absolute top-2.5 right-2.5 w-[7px] h-[7px] rounded-full bg-accent border-[1.5px] border-surface" />
    </button>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Bonjour, {firstName}</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">{cap(dateFull)} · voici votre activité</div>
        </div>
        <div className="flex items-center gap-3">
          {bell}
          {totalUnpaid > 0 && (
            <AccentButton onClick={handleRequest} disabled={requesting}>
              <IconArrowDown size={15} /> Demander un versement
            </AccentButton>
          )}
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}
        {!loading && error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>
        )}
        {!loading && paymentSuccess && (
          <div className="p-3 rounded-2xl bg-accent-soft border border-accent/20 text-accent text-sm">{paymentSuccess}</div>
        )}

        {!loading && data && (<>
          {/* Mobile greeting */}
          <div className="lg:hidden flex items-center justify-between pt-1">
            <div>
              <div className="text-[12px] text-ink-faint">{cap(dateLong)}</div>
              <div className="text-[20px] font-bold tracking-[-0.02em] text-ink mt-0.5">Bonjour, {firstName}</div>
            </div>
            <div className="flex items-center gap-2.5">
              {bell}
              {artist?.artwork_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.artwork_url} alt={artist.name} className="w-[38px] h-[38px] rounded-full object-cover" />
              ) : (
                <div className="w-[38px] h-[38px] rounded-full bg-accent-soft text-accent flex items-center justify-center text-[13px] font-bold">{initials}</div>
              )}
            </div>
          </div>

          {/* Hero + KPIs */}
          <div className="grid gap-3 lg:gap-4 lg:grid-cols-[1.55fr_1fr]">
            {/* Hero */}
            <Card hero padded={false} className="rounded-hero p-5 lg:p-6 flex flex-col justify-between">
              <div>
                <Eyebrow>Disponible au versement</Eyebrow>
                <div className="roy-num text-[46px] font-bold text-ink leading-none mt-2">
                  {fmtMoney(displayAvailable, currency)}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="w-[7px] h-[7px] rounded-full bg-accent" />
                  <span className="text-[12.5px] text-ink-muted">
                    <span className="text-ink font-semibold">+ {fmtMoney(pendingValidation, currency)}</span> en cours de validation
                  </span>
                </div>
              </div>
              {/* Mobile actions */}
              <div className="flex gap-2.5 mt-4 lg:hidden">
                <AccentButton onClick={handleRequest} disabled={requesting || totalUnpaid === 0} className="flex-1">
                  {requesting ? <Spinner size="sm" /> : <><IconArrowDown size={15} /> Demander un versement</>}
                </AccentButton>
                <Link href="/statements" className="flex items-center justify-center w-12 rounded-[13px] border border-line-strong bg-surface text-ink">
                  <IconFile size={17} />
                </Link>
              </div>
              {sparkPoints.length > 1 && <Sparkline points={sparkPoints} height={30} className="mt-4 hidden lg:block" />}
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
              <Card className="lg:flex-1">
                <Eyebrow className="text-[9.5px]">Cumul net 2025</Eyebrow>
                <div className="roy-num text-[21px] lg:text-[27px] font-bold text-ink mt-1.5 lg:mt-2">{fmtMoney(data.total_net, currency)}</div>
                <div className="hidden lg:block text-[11.5px] text-ink-muted mt-2.5">sur {fmtMoney(data.total_gross, currency)} bruts</div>
              </Card>
              <Card className="lg:flex-1">
                <Eyebrow className="text-[9.5px]">Revenus bruts</Eyebrow>
                <div className="roy-num text-[21px] lg:text-[27px] font-bold text-ink mt-1.5 lg:mt-2">{fmtMoney(data.total_gross, currency)}</div>
                <div className="hidden lg:block text-[11.5px] text-ink-muted mt-2.5">{fmtNum(data.total_streams)} streams cumulés</div>
              </Card>
            </div>
          </div>

          {/* Activity + side */}
          <div className="grid gap-3 lg:gap-4 lg:grid-cols-[1.55fr_1fr]">
            {/* Activity */}
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center justify-between px-[22px] py-4 border-b border-line">
                <span className="text-[14px] font-semibold text-ink">Activité récente</span>
                <Link href="/statements" className="text-[12px] font-semibold text-accent">Tout voir</Link>
              </div>
              {activity.length === 0 ? (
                <div className="px-[22px] py-8 text-center text-[13px] text-ink-faint">Aucune activité récente</div>
              ) : (
                activity.map((a, i) => (
                  <div key={a.id} className={`flex items-center gap-3.5 px-[22px] py-3.5 ${i < activity.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.inflow ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'}`}>
                      {a.inflow ? <IconInflow size={18} /> : <IconOutflow size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{a.label}</div>
                      <div className="text-[11.5px] text-ink-faint mt-0.5">{a.sub}</div>
                    </div>
                    <span className={`roy-num text-[14px] font-bold ${a.inflow ? 'text-accent' : 'text-ink-muted'}`}>
                      {a.inflow ? '+' : '−'} {fmtMoney(Math.abs(a.amount), currency)}
                    </span>
                  </div>
                ))
              )}
            </Card>

            {/* Side */}
            <div className="flex flex-col gap-3 lg:gap-4">
              {/* Prochain versement */}
              <Card padded className="p-5">
                <span className="text-[14px] font-semibold text-ink">Prochain versement</span>
                <div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtMoney(displayAvailable, currency)}</div>
                <div className="text-[12px] text-ink-faint mt-2">
                  {pendingValidation > 0 ? 'En attente de validation' : 'Disponible immédiatement'}
                </div>
                {totalUnpaid > 0 && (
                  <div className="h-1.5 rounded-full bg-track overflow-hidden mt-3">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((available / (totalUnpaid || 1)) * 100)}%` }} />
                  </div>
                )}
              </Card>

              {/* Top titres */}
              <Card padded className="p-5 flex-1">
                <div className="text-[14px] font-semibold text-ink mb-3.5">Top titres</div>
                {topTracks.length === 0 ? (
                  <div className="text-[13px] text-ink-faint">Aucun titre</div>
                ) : (
                  <div className="flex flex-col gap-3.5">
                    {topTracks.map((t, i) => (
                      <div key={t.isrc} className="flex items-center gap-3">
                        <span className="font-mono text-[12px] text-ink-faint w-3">{i + 1}</span>
                        <div className="w-9 h-9 rounded-[9px] bg-surface-2 flex items-center justify-center text-ink-faint shrink-0">
                          <IconMusic size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-ink truncate">{t.title}</div>
                          <div className="text-[11px] text-ink-faint truncate">{t.release_title || 'Single'}</div>
                        </div>
                        <span className="roy-num text-[12.5px] text-ink-muted">{fmtNum(t.streams)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>)}
      </main>
    </div>
  );
}
