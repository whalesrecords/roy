'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getArtistPayments, getStatements, getProfile, requestPayment,
  ArtistPayment, Statement, ArtistProfile,
} from '@/lib/api';
import { Card, Eyebrow, Pill, AccentButton, fmtMoney } from '@/components/roy/ui';
import { IconArrowDown, IconCard, IconCheck } from '@/components/roy/icons';

function maskIban(iban?: string) {
  if (!iban) return null;
  const clean = iban.replace(/\s+/g, '');
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

export default function PaymentsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!artist) return;
    Promise.all([getArtistPayments(), getStatements()])
      .then(([p, s]) => { setPayments(p); setStatements(s); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => setLoading(false));
    getProfile().then(setProfile).catch(() => {});
  }, [artist]);

  const currency = payments[0]?.currency || statements[0]?.currency || 'EUR';
  const thisYear = new Date().getFullYear();
  const totalPaid = payments
    .filter((p) => new Date(p.date).getFullYear() === thisYear)
    .reduce((s, p) => s + parseFloat(p.amount), 0) || payments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const unpaid = statements.filter((s) => s.status !== 'paid');
  const available = unpaid.reduce((s, x) => s + parseFloat(x.net_payable), 0);

  const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date));
  const iban = maskIban(profile?.iban);

  const handleRequest = async () => {
    if (!unpaid.length) return;
    setRequesting(true);
    try {
      await requestPayment(unpaid[0].id);
      setSuccess('Demande de versement envoyée !');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setRequesting(false);
    }
  };

  const reference = (p: ArtistPayment) => {
    const d = new Date(p.date);
    return `PAY-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };
  const dateLong = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateShort = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const sepaCard = (
    <div className="flex items-center gap-3.5">
      <div className="w-11 h-11 rounded-xl bg-surface-2 text-ink-muted flex items-center justify-center shrink-0"><IconCard size={20} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">Compte SEPA</div>
        <div className="font-mono text-[12px] text-ink-faint mt-0.5">{iban || 'Non renseigné'}</div>
      </div>
      <Link href="/settings" className="text-[12px] font-semibold text-accent">Modifier</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Paiements</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Versements et coordonnées bancaires</div>
        </div>
        {available > 0 && (
          <AccentButton onClick={handleRequest} disabled={requesting}>
            <IconArrowDown size={15} /> Demander un versement
          </AccentButton>
        )}
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {(authLoading || loading) ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" color="primary" /></div>
        ) : (<>
          {error && <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>}
          {success && <div className="p-3 rounded-2xl bg-accent-soft border border-accent/20 text-accent text-sm">{success}</div>}

          {/* Mobile total */}
          <div className="lg:hidden">
            <Eyebrow>Total versé · {thisYear}</Eyebrow>
            <div className="roy-num text-[48px] font-bold text-ink leading-none mt-1.5">{fmtMoney(totalPaid, currency)}</div>
          </div>

          {/* Mobile available + CTA */}
          <Card hero className="lg:hidden p-[18px] rounded-[20px]">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-ink-muted">Disponible maintenant</span>
              <span className="roy-num text-[18px] font-bold text-ink">{fmtMoney(available, currency)}</span>
            </div>
            <AccentButton onClick={handleRequest} disabled={requesting || available === 0} className="w-full mt-3.5">
              {requesting ? <Spinner size="sm" /> : <><IconArrowDown size={15} /> Demander un versement</>}
            </AccentButton>
          </Card>

          {/* Mobile SEPA */}
          <Card className="lg:hidden rounded-[16px]">{sepaCard}</Card>

          {/* Desktop 3 cards */}
          <div className="hidden lg:grid grid-cols-[1fr_1fr_1.2fr] gap-4">
            <Card hero><Eyebrow className="text-[9.5px]">Disponible maintenant</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtMoney(available, currency)}</div></Card>
            <Card><Eyebrow className="text-[9.5px]">Total versé {thisYear}</Eyebrow><div className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalPaid, currency)}</div></Card>
            <Card>{sepaCard}</Card>
          </div>

          {/* Mobile history */}
          <div className="lg:hidden">
            <div className="text-[13px] font-semibold text-ink mt-3 mb-1">Historique</div>
            {sorted.length === 0 ? (
              <div className="text-center py-10 text-ink-faint text-sm">Aucun versement</div>
            ) : (
              <div className="flex flex-col">
                {sorted.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3.5 py-3.5 ${i < sorted.length - 1 ? 'border-b border-line' : ''}`}>
                    <div className="w-9 h-9 rounded-[11px] bg-accent-soft text-accent flex items-center justify-center shrink-0"><IconCheck size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink">{p.description || 'Versement SEPA'}</div>
                      <div className="text-[11px] text-ink-faint mt-0.5">{dateShort(p.date)} · Reçu</div>
                    </div>
                    <span className="roy-num text-[14px] font-bold text-ink">{fmtMoney(p.amount, p.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop history table */}
          <Card padded={false} className="hidden lg:block overflow-hidden">
            <div className="px-6 py-4 border-b border-line text-[14px] font-semibold text-ink">Historique des versements</div>
            <div role="table" aria-label="Historique des versements">
              <div role="row" className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr] px-6 py-3 border-b border-line roy-eyebrow text-[10px]">
                <span role="columnheader">Date</span><span role="columnheader">Référence</span><span role="columnheader" className="text-center">Statut</span><span role="columnheader" className="text-right">Montant</span>
              </div>
              {sorted.length === 0 ? (
                <div className="px-6 py-10 text-center text-ink-faint text-sm">Aucun versement</div>
              ) : sorted.map((p) => (
                <div key={p.id} role="row" className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr] items-center px-6 py-4 border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                  <span role="cell" className="text-[13.5px] font-semibold text-ink">{dateLong(p.date)}</span>
                  <span role="cell" className="font-mono text-[12px] text-ink-faint">{reference(p)}</span>
                  <span role="cell" className="flex justify-center"><Pill tone="accent">Reçu</Pill></span>
                  <span role="cell" className="text-right roy-num text-[13.5px] font-bold text-ink">{fmtMoney(p.amount, p.currency)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>)}
      </main>
    </div>
  );
}
