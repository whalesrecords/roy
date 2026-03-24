'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, AdvanceEntry, EXPENSE_CATEGORIES, ExpenseCategory } from '@/lib/types';
import { WHALES_LOGO_BASE64 } from '@/lib/whales-logo';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAdvances,
  createAdvance,
  updateAdvance,
  deleteAdvance,
  getAdvanceBalance,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getArtistReleases,
  getArtistTracks,
  calculateArtistRoyalties,
  getLabelSettings,
  createStatement,
  getArtistStatements,
  CatalogRelease,
  CatalogTrack,
  ArtistRoyaltyCalculation,
  LabelSettings,
} from '@/lib/api';

// Period type for quarter/year selection
interface Period {
  label: string;
  value: string;
  start: string;
  end: string;
  type: 'quarter' | 'year';
}

function generatePeriods(): Period[] {
  const periods: Period[] = [];
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  for (let year = currentYear; year >= currentYear - 4; year--) {
    periods.push({ label: `${year} (annee)`, value: `year-${year}`, start: `${year}-01-01`, end: `${year}-12-31`, type: 'year' });
    const maxQuarter = year === currentYear ? currentQuarter : 4;
    for (let q = maxQuarter; q >= 1; q--) {
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const monthNames = ['Jan-Mar', 'Avr-Jun', 'Jul-Sep', 'Oct-Dec'];
      periods.push({ label: `Q${q} ${year} (${monthNames[q - 1]})`, value: `Q${q}-${year}`, start: `${year}-${String(startMonth).padStart(2, '0')}-01`, end: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`, type: 'quarter' });
    }
  }
  return periods;
}

const PERIODS = generatePeriods();

const formatPercent = (decimal: number) => {
  const pct = decimal * 100;
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2).replace(/0+$/, '');
};

const formatNumber = (value: number) => value.toLocaleString('fr-FR');

// Helper to write HTML to a print window safely
function writePrintWindow(content: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}

interface FinancesTabProps {
  artist: Artist;
  artistId: string;
}

export default function FinancesTab({ artist, artistId }: FinancesTabProps) {
  const { displayName, user } = useAuth();
  const generatedByName = displayName || user?.email || 'Unknown';

  const [balance, setBalance] = useState<string>('0');
  const [balanceCurrency, setBalanceCurrency] = useState<string>('EUR');
  const [totalAdvances, setTotalAdvances] = useState<string>('0');
  const [totalRecouped, setTotalRecouped] = useState<string>('0');
  const [totalPayments, setTotalPayments] = useState<string>('0');
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDescription, setAdvanceDescription] = useState('');
  const [advanceScope, setAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [advanceScopeId, setAdvanceScopeId] = useState('');
  const [advanceCategory, setAdvanceCategory] = useState<ExpenseCategory | ''>('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [creatingAdvance, setCreatingAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceEntry | null>(null);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState('');
  const [editAdvanceDescription, setEditAdvanceDescription] = useState('');
  const [editAdvanceScope, setEditAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [editAdvanceScopeId, setEditAdvanceScopeId] = useState('');
  const [editAdvanceCategory, setEditAdvanceCategory] = useState<ExpenseCategory | ''>('');
  const [editAdvanceDate, setEditAdvanceDate] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);
  const [payments, setPayments] = useState<AdvanceEntry[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<AdvanceEntry | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDescription, setEditPaymentDescription] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(PERIODS[1]?.value || PERIODS[0]?.value || '');
  const [calculatingRoyalties, setCalculatingRoyalties] = useState(false);
  const [royaltyResult, setRoyaltyResult] = useState<ArtistRoyaltyCalculation | null>(null);
  const [royaltyError, setRoyaltyError] = useState<string | null>(null);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [publishingStatement, setPublishingStatement] = useState(false);
  const [paidQuarters, setPaidQuarters] = useState<{ quarter: string; amount: number; date: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [advancesData, balanceData, paymentsData] = await Promise.all([
        getAdvances(artistId),
        getAdvanceBalance(artistId),
        getPayments(artistId),
      ]);
      setAdvances(advancesData);
      setBalance(balanceData.balance);
      setBalanceCurrency(balanceData.currency || 'EUR');
      setTotalAdvances(balanceData.total_advances || '0');
      setTotalRecouped(balanceData.total_recouped || '0');
      setTotalPayments(balanceData.total_payments || '0');
      setPayments(paymentsData);
      if (artist.name) {
        try {
          const [releasesData, tracksData] = await Promise.all([getArtistReleases(artist.name), getArtistTracks(artist.name)]);
          setReleases(releasesData);
          setTracks(tracksData);
        } catch { /* catalog optional */ }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur de chargement'); }
  }, [artistId, artist.name]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateAdvance = async () => {
    if (!advanceAmount) return;
    if (advanceScope !== 'catalog' && !advanceScopeId) return;
    setCreatingAdvance(true);
    try {
      await createAdvance(artistId, parseFloat(advanceAmount), 'EUR', advanceDescription || undefined, advanceScope, advanceScope !== 'catalog' ? advanceScopeId : undefined, advanceCategory || undefined, advanceDate || undefined);
      setShowAdvanceForm(false); setAdvanceAmount(''); setAdvanceDescription(''); setAdvanceScope('catalog'); setAdvanceScopeId(''); setAdvanceCategory(''); setAdvanceDate('');
      loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setCreatingAdvance(false); }
  };

  const handleEditAdvance = (advance: AdvanceEntry) => {
    setEditingAdvance(advance); setEditAdvanceAmount(advance.amount); setEditAdvanceDescription(advance.description || ''); setEditAdvanceScope(advance.scope || 'catalog'); setEditAdvanceScopeId(advance.scope_id || ''); setEditAdvanceCategory(advance.category || ''); setEditAdvanceDate(advance.effective_date || '');
  };

  const handleUpdateAdvance = async () => {
    if (!editingAdvance || !editAdvanceAmount) return;
    if (editAdvanceScope !== 'catalog' && !editAdvanceScopeId) return;
    setSavingAdvance(true);
    try {
      await updateAdvance(artistId, editingAdvance.id, parseFloat(editAdvanceAmount), 'EUR', editAdvanceDescription || undefined, editAdvanceScope, editAdvanceScope !== 'catalog' ? editAdvanceScopeId : undefined, editAdvanceCategory || undefined, editAdvanceDate || undefined);
      setEditingAdvance(null); loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setSavingAdvance(false); }
  };

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm('Supprimer cette avance ?')) return;
    setDeletingAdvanceId(advanceId);
    try { await deleteAdvance(artistId, advanceId); loadData(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setDeletingAdvanceId(null); }
  };

  const handleCreatePayment = async () => {
    if (!paymentAmount) return;
    setCreatingPayment(true);
    try {
      await createPayment(artistId, parseFloat(paymentAmount), 'EUR', paymentDescription || undefined, paymentDate || undefined);
      setShowPaymentForm(false); setPaymentAmount(''); setPaymentDescription(''); setPaymentDate(''); loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setCreatingPayment(false); }
  };

  const handleEditPayment = (payment: AdvanceEntry) => { setEditingPayment(payment); setEditPaymentAmount(payment.amount); setEditPaymentDescription(payment.description || ''); setEditPaymentDate(payment.effective_date.split('T')[0]); };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    setSavingPayment(true);
    try { await updatePayment(artistId, editingPayment.id, parseFloat(editPaymentAmount), editPaymentDescription, editPaymentDate); setEditingPayment(null); loadData(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setSavingPayment(false); }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Supprimer ce versement ?')) return;
    setDeletingPaymentId(paymentId);
    try { await deletePayment(artistId, paymentId); loadData(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setDeletingPaymentId(null); }
  };

  const handleCalculateRoyalties = async () => {
    const period = PERIODS.find(p => p.value === selectedPeriod);
    if (!period) return;
    setCalculatingRoyalties(true); setRoyaltyError(null); setRoyaltyResult(null); setPaidQuarters([]);
    try {
      const result = await calculateArtistRoyalties(artistId, period.start, period.end);
      setRoyaltyResult(result);
      if (period.type === 'year') {
        const year = period.value.replace('year-', '');
        const quarterPatterns = [`Q1 ${year}`, `Q2 ${year}`, `Q3 ${year}`, `Q4 ${year}`];
        const paid = payments.filter(p => quarterPatterns.some(q => (p.description || '').includes(q))).map(p => ({ quarter: (p.description || '').replace('Paiement ', ''), amount: parseFloat(p.amount), date: p.effective_date }));
        setPaidQuarters(paid);
      }
    } catch (err) { setRoyaltyError(err instanceof Error ? err.message : 'Erreur de calcul'); } finally { setCalculatingRoyalties(false); }
  };

  const handleMarkAsPaid = async () => {
    if (!royaltyResult) return;
    const paidTotal = paidQuarters.reduce((sum, pq) => sum + pq.amount, 0);
    const remaining = parseFloat(royaltyResult.net_payable) - paidTotal;
    if (remaining <= 0) return;
    const period = PERIODS.find(p => p.value === selectedPeriod);
    if (!period) return;
    setMarkingAsPaid(true);
    try {
      let statementId: string | undefined;
      try {
        const { statements } = await getArtistStatements(artistId);
        const matchingStmt = statements.find((stmt: { period_start: string; period_end: string; status: string }) => stmt.period_start === royaltyResult.period_start && stmt.period_end === royaltyResult.period_end && stmt.status === 'finalized');
        if (matchingStmt) statementId = matchingStmt.id;
      } catch { /* ignore */ }
      await createPayment(artistId, remaining, 'EUR', `Paiement ${period.label.split(' (')[0]}`, new Date().toISOString().split('T')[0], statementId);
      await loadData(); setRoyaltyResult(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setMarkingAsPaid(false); }
  };

  const handlePublishStatement = async () => {
    if (!royaltyResult) return;
    setPublishingStatement(true);
    try {
      await createStatement(artistId, { artist_id: artistId, period_start: royaltyResult.period_start, period_end: royaltyResult.period_end, currency: royaltyResult.currency, gross_revenue: royaltyResult.total_gross, artist_royalties: royaltyResult.total_artist_royalties, label_royalties: royaltyResult.total_label_royalties, advance_balance: royaltyResult.advance_balance, recouped: royaltyResult.recoupable, net_payable: royaltyResult.net_payable, transaction_count: royaltyResult.albums.reduce((sum: number, a: { track_count: number }) => sum + a.track_count, 0), finalize: true });
      alert("Releve publie sur l'Espace Artiste !");
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setPublishingStatement(false); }
  };

  const handleExportCSV = () => {
    if (!royaltyResult) return;
    const lines: string[] = [];
    lines.push(`Releve de royalties - ${artist.name}`);
    lines.push(`Periode: ${new Date(royaltyResult.period_start).toLocaleDateString('fr-FR')} - ${new Date(royaltyResult.period_end).toLocaleDateString('fr-FR')}`);
    lines.push('');
    lines.push('RESUME');
    lines.push(`Brut total;${royaltyResult.total_gross} ${royaltyResult.currency}`);
    lines.push(`Royalties artiste;${royaltyResult.total_artist_royalties} ${royaltyResult.currency}`);
    lines.push(`Royalties label;${royaltyResult.total_label_royalties} ${royaltyResult.currency}`);
    lines.push(`Solde avance;${royaltyResult.advance_balance} ${royaltyResult.currency}`);
    lines.push(`Recoupable;${royaltyResult.recoupable} ${royaltyResult.currency}`);
    lines.push(`Net payable;${royaltyResult.net_payable} ${royaltyResult.currency}`);
    lines.push('');
    if (royaltyResult.sources && royaltyResult.sources.length > 0) {
      lines.push('DETAIL PAR SOURCE');
      lines.push('Source;Transactions;Streams;Brut;Royalties artiste;Royalties label');
      for (const source of royaltyResult.sources) lines.push([source.source_label, source.transaction_count.toString(), source.streams.toString(), `${source.gross} ${royaltyResult.currency}`, `${source.artist_royalties} ${royaltyResult.currency}`, `${source.label_royalties} ${royaltyResult.currency}`].join(';'));
      lines.push('');
    }
    lines.push('DETAIL PAR ALBUM');
    lines.push('Album;UPC;Tracks;Streams;Brut;Part artiste;Royalties artiste;Avance album;Recoupe;Net album;Inclus dans');
    for (const album of royaltyResult.albums) {
      const advBal = parseFloat(album.advance_balance || '0');
      const recp = parseFloat(album.recoupable || '0');
      const netP = parseFloat(album.net_payable || album.artist_royalties);
      const isIncl = !!album.included_in_upc;
      const parent = isIncl ? royaltyResult.albums.find(a => a.upc === album.included_in_upc) : null;
      lines.push([album.release_title, album.upc, album.track_count.toString(), album.streams.toString(), `${album.gross} ${royaltyResult.currency}`, `${formatPercent(parseFloat(album.artist_share || '0'))}%`, `${album.artist_royalties} ${royaltyResult.currency}`, advBal > 0 ? `${advBal} ${royaltyResult.currency}` : '-', recp > 0 ? `${recp} ${royaltyResult.currency}` : '-', isIncl ? 'Inclus dans album' : `${netP} ${royaltyResult.currency}`, parent ? parent.release_title : '-'].join(';'));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `royalties_${artist.name.replace(/\s+/g, '_')}_${royaltyResult.period_start}_${royaltyResult.period_end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF generation functions use writePrintWindow helper - these produce print-ready HTML
  // The HTML templates are kept as-is from the original monolith for pixel-perfect compatibility
  const handlePrintPDF = async () => {
    if (!royaltyResult) return;
    let labelSettings: LabelSettings | null = null;
    try { labelSettings = await getLabelSettings(); } catch { /* ignore */ }
    const fmtDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtCurrency = (value: string) => parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: royaltyResult.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtNumber = (value: number) => value.toLocaleString('en-US');
    const labelHeaderHtml = labelSettings ? `<div class="label-header">${labelSettings.logo_base64 ? `<img src="${labelSettings.logo_base64}" alt="${labelSettings.label_name}" class="label-logo" />` : ''}<div class="label-info"><div class="label-name">${labelSettings.label_name}</div>${[labelSettings.address_line1, labelSettings.address_line2, [labelSettings.postal_code, labelSettings.city].filter(Boolean).join(' '), labelSettings.country, labelSettings.email, labelSettings.phone, labelSettings.website].filter(Boolean).map(l => `<div>${l}</div>`).join('')}${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}${labelSettings.vat_number ? `<div class="legal">VAT: ${labelSettings.vat_number}</div>` : ''}</div></div>` : '';
    const albumRows = royaltyResult.albums.map(album => { const advBal = parseFloat(album.advance_balance || '0'); const recp = parseFloat(album.recoupable || '0'); const netP = parseFloat(album.net_payable || album.artist_royalties); const hasAdv = advBal > 0; const isIncl = !!album.included_in_upc; const parent = isIncl ? royaltyResult.albums.find(a => a.upc === album.included_in_upc) : null; return `<tr style="${isIncl ? 'background:#fef3c7;' : ''}"><td><div>${album.release_title}</div><div class="mono">UPC: ${album.upc}</div>${isIncl ? `<div style="font-size:11px;color:#92400e;margin-top:4px;">Included in ${parent?.release_title || 'album'} recoupment</div>` : ''}</td><td>${album.track_count}</td><td class="right">${fmtNumber(album.streams)}</td><td class="right">${isIncl ? `<span style="text-decoration:line-through;color:#999;">${fmtCurrency(album.gross)}</span>` : fmtCurrency(album.gross)}</td><td class="right">${formatPercent(parseFloat(album.artist_share || '0'))}%</td><td class="right">${(hasAdv || isIncl) ? `<span style="text-decoration:line-through;color:#999;">${fmtCurrency(album.artist_royalties)}</span>` : fmtCurrency(album.artist_royalties)}</td><td class="right" style="color:${hasAdv ? '#b45309' : '#999'};">${hasAdv ? `-${fmtCurrency(recp.toString())}` : '-'}</td><td class="right" style="font-weight:${hasAdv ? 'bold' : 'normal'};">${isIncl ? '-' : fmtCurrency(netP.toString())}</td></tr>`; }).join('');
    const sourceRows = royaltyResult.sources?.map(s => { const isSales = s.source_label.toLowerCase() === 'bandcamp' || s.source_label.toLowerCase() === 'squarespace'; return `<tr><td>${s.source_label}</td><td class="right">${fmtNumber(s.transaction_count)}</td><td class="right">${fmtNumber(s.streams)} ${isSales ? 'sale' : 'stream'}${s.streams > 1 ? 's' : ''}</td><td class="right">${fmtCurrency(s.gross)}</td><td class="right">${fmtCurrency(s.artist_royalties)}</td></tr>`; }).join('') || '';
    const paidRows = paidQuarters.map(pq => `<tr><td>${pq.quarter}</td><td>${fmtDate(new Date(pq.date))}</td><td class="right" style="color:#b45309;">-${fmtCurrency(pq.amount.toString())}</td></tr>`).join('');
    writePrintWindow(`<!DOCTYPE html><html><head><title>Royalty Statement - ${artist.name}</title><style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:'Roboto',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;max-width:800px;margin:0 auto;background:white}.label-header{position:absolute;top:40px;right:40px;text-align:right}.label-logo{max-width:80px;max-height:50px;object-fit:contain;margin-bottom:8px}.label-info{font-size:11px;color:#4b5563;line-height:1.5}.label-name{font-size:14px;font-weight:600;color:#111827;margin-bottom:4px}.label-info .legal{color:#6b7280;font-size:10px;margin-top:4px}.main-content{margin-top:120px}h1{font-size:24px;margin-bottom:8px;color:#111827;font-weight:700}h2{font-size:18px;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #6E56CF;padding-bottom:8px;color:#111827;font-weight:600}.period{color:#6b7280;font-size:14px;margin-bottom:24px;padding:8px 16px;background:#f3f4f6;border-radius:20px;display:inline-block}.summary{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px}.summary-item{background:#f8fafc;padding:16px;border-radius:12px;border:1px solid #e5e7eb}.summary-item label{font-size:12px;color:#6b7280;display:block;margin-bottom:4px}.summary-item value{font-size:18px;font-weight:600;color:#111827}.highlight{background:linear-gradient(135deg,#6E56CF10 0%,#22c55e10 100%)!important;border:1px solid #22c55e30!important}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #e5e7eb}th{background:#f8fafc;font-weight:600;color:#374151}.mono{font-family:monospace;font-size:12px;color:#6b7280}.right{text-align:right}.footer{margin-top:30px;padding:20px 0 10px 0;border-top:2px solid #e5e7eb;text-align:center;page-break-inside:avoid}.footer-logo{max-width:150px;max-height:60px;margin:0 auto 10px;display:block;opacity:0.7}.footer-text{font-size:10px;color:#9ca3af;margin-top:5px}@page{margin:20mm 15mm 30mm 15mm}@media print{body{padding:20px}.label-header{top:20px;right:20px}.footer{page-break-inside:avoid}}</style></head><body>${labelHeaderHtml}<div class="main-content"><h1>Royalty Statement</h1><p style="font-size:18px;margin-bottom:4px;">${artist.name}</p><p class="period">Period: ${fmtDate(new Date(royaltyResult.period_start))} - ${fmtDate(new Date(royaltyResult.period_end))}</p><h2>Summary</h2><div class="summary"><div class="summary-item"><label>Gross Revenue</label><value>${fmtCurrency(royaltyResult.total_gross)}</value></div><div class="summary-item"><label>Artist Royalties</label><value>${fmtCurrency(royaltyResult.total_artist_royalties)}</value></div><div class="summary-item"><label>Advance Balance</label><value>${fmtCurrency(royaltyResult.advance_balance)}</value></div><div class="summary-item"><label>Recoupable</label><value>${fmtCurrency(royaltyResult.recoupable)}</value></div><div class="summary-item highlight" style="grid-column:span 2;"><label>Net Payable</label><value style="font-size:24px;">${fmtCurrency(royaltyResult.net_payable)}</value></div></div>${paidQuarters.length > 0 ? `<h2>Previously Paid Quarters</h2><table><thead><tr><th>Quarter</th><th>Payment Date</th><th class="right">Amount</th></tr></thead><tbody>${paidRows}<tr style="font-weight:bold;background:linear-gradient(135deg,#22c55e10 0%,#22c55e15 100%);"><td colspan="2">Remaining Balance</td><td class="right" style="color:#22c55e;font-size:18px;">${fmtCurrency((parseFloat(royaltyResult.net_payable)-paidQuarters.reduce((sum,pq)=>sum+pq.amount,0)).toString())}</td></tr></tbody></table>` : ''}${royaltyResult.sources && royaltyResult.sources.length > 0 ? `<h2>Revenue by Source</h2><table><thead><tr><th>Source</th><th class="right">Transactions</th><th class="right">Streams/Sales</th><th class="right">Gross</th><th class="right">Royalties</th></tr></thead><tbody>${sourceRows}</tbody></table>` : ''}<h2>Album Details</h2><table><thead><tr><th>Album</th><th>Tracks</th><th class="right">Streams</th><th class="right">Gross</th><th class="right">Share</th><th class="right">Royalties</th><th class="right">Advance</th><th class="right">Net</th></tr></thead><tbody>${albumRows}</tbody></table><div class="footer"><img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" /><div class="footer-text">Generated on ${fmtDate(new Date())} at ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} by ${generatedByName}${labelSettings?.label_name ? ` - ${labelSettings.label_name}` : ''}</div></div></div></body></html>`);
  };

  const handlePrintExpensesPDF = async () => {
    if (!royaltyResult) return;
    let labelSettings: LabelSettings | null = null;
    try { labelSettings = await getLabelSettings(); } catch { /* ignore */ }
    let advancesList: AdvanceEntry[] = [];
    try { const allAdv = await getAdvances(artist.id); advancesList = allAdv.filter(a => a.entry_type === 'advance'); } catch { /* ignore */ }
    if (advancesList.length === 0) { alert('No advances to display'); return; }
    const fmtDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtCurrency = (value: string) => parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: royaltyResult.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const advancesByCategory: Record<string, { total: number; items: AdvanceEntry[] }> = {};
    for (const adv of advancesList) { const cat = adv.category || 'general'; if (!advancesByCategory[cat]) advancesByCategory[cat] = { total: 0, items: [] }; advancesByCategory[cat].total += parseFloat(adv.amount); advancesByCategory[cat].items.push(adv); }
    const categoryLabels: Record<string, string> = { general: 'General', recording: 'Recording', mixing: 'Mixing', mastering: 'Mastering', artwork: 'Artwork', photos: 'Photos', video: 'Video', pr: 'PR / Press', advertising: 'Advertising', distribution: 'Distribution', cd: 'CD Production', vinyl: 'Vinyl Production', goodies: 'Goodies / Merch', other: 'Other' };
    const labelHeaderHtml = labelSettings ? `<div class="label-header">${labelSettings.logo_base64 ? `<img src="${labelSettings.logo_base64}" alt="${labelSettings.label_name}" class="label-logo" />` : ''}<div class="label-info"><div class="label-name">${labelSettings.label_name}</div>${[labelSettings.address_line1, labelSettings.address_line2, [labelSettings.postal_code, labelSettings.city].filter(Boolean).join(' '), labelSettings.country, labelSettings.email].filter(Boolean).map(l => `<div>${l}</div>`).join('')}${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}${labelSettings.vat_number ? `<div class="legal">TVA: ${labelSettings.vat_number}</div>` : ''}</div></div>` : '';
    const totalAdv = advancesList.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    writePrintWindow(`<!DOCTYPE html><html><head><title>Expenses Statement - ${artist.name}</title><style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:'Roboto',-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto;background:white}.label-header{position:absolute;top:40px;right:40px;text-align:right}.label-logo{max-width:80px;max-height:50px;object-fit:contain;margin-bottom:8px}.label-info{font-size:11px;color:#4b5563;line-height:1.5}.label-name{font-size:14px;font-weight:600;color:#111827;margin-bottom:4px}.label-info .legal{color:#6b7280;font-size:10px;margin-top:4px}.main-content{margin-top:120px}h1{font-size:24px;margin-bottom:8px;color:#111827;font-weight:700}h2{font-size:18px;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #f59e0b;padding-bottom:8px;color:#111827;font-weight:600}.period{color:#6b7280;font-size:14px;margin-bottom:24px;padding:8px 16px;background:#f3f4f6;border-radius:20px;display:inline-block}.summary-box{background:linear-gradient(135deg,#f59e0b10 0%,#f59e0b15 100%);padding:24px;border-radius:16px;margin-bottom:24px;text-align:center;border:1px solid #f59e0b25}.summary-box label{font-size:14px;color:#92400e;display:block;margin-bottom:8px}.summary-box value{font-size:28px;font-weight:700;color:#d97706}.category-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}.category-item{background:#f8fafc;padding:14px;border-radius:12px;text-align:center;border:1px solid #e5e7eb}.category-item label{font-size:11px;color:#6b7280;display:block;margin-bottom:4px}.category-item value{font-size:16px;font-weight:600;color:#d97706}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #e5e7eb}th{background:#f8fafc;font-weight:600;color:#374151}.right{text-align:right}.footer{margin-top:30px;padding:20px 0 10px 0;border-top:2px solid #e5e7eb;text-align:center}.footer-logo{max-width:150px;max-height:60px;margin:0 auto 10px;display:block;opacity:0.7}.footer-text{font-size:10px;color:#9ca3af}@media print{body{padding:20px}}</style></head><body>${labelHeaderHtml}<div class="main-content"><h1>Expenses Statement</h1><p style="font-size:18px;margin-bottom:4px;">${artist.name}</p><p class="period">As of ${fmtDate(new Date())}</p><div class="summary-box"><label>Total Advances &amp; Expenses</label><value>${fmtCurrency(totalAdv.toString())}</value></div><h2>By Category</h2><div class="category-summary">${Object.entries(advancesByCategory).map(([cat, data]) => `<div class="category-item"><label>${categoryLabels[cat] || cat}</label><value>${fmtCurrency(data.total.toString())}</value></div>`).join('')}</div><h2>Detailed History</h2><table><thead><tr><th>Date</th><th>Category</th><th>Scope</th><th>Description</th><th class="right">Amount</th></tr></thead><tbody>${advancesList.map(adv => { const catLabel = categoryLabels[adv.category || 'general'] || adv.category || 'General'; let scopeLabel = 'Catalog'; if (adv.scope === 'release' && adv.scope_id) { const album = royaltyResult.albums.find(a => a.upc === adv.scope_id); scopeLabel = album ? album.release_title : `UPC: ${adv.scope_id}`; } else if (adv.scope === 'track' && adv.scope_id) scopeLabel = `Track: ${adv.scope_id}`; return `<tr><td>${fmtDate(new Date(adv.effective_date))}</td><td>${catLabel}</td><td>${scopeLabel}</td><td>${adv.description || '-'}</td><td class="right" style="color:#b45309;font-weight:600;">${fmtCurrency(adv.amount)}</td></tr>`; }).join('')}</tbody></table><div class="footer"><img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" /><div class="footer-text">Generated on ${fmtDate(new Date())} at ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} by ${generatedByName}${labelSettings?.label_name ? ` - ${labelSettings.label_name}` : ''}</div></div></div></body></html>`);
  };

  const handlePrintArtistPDF = async () => {
    if (!royaltyResult) return;
    let labelSettings: LabelSettings | null = null;
    try { labelSettings = await getLabelSettings(); } catch { /* ignore */ }
    const fmtDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const fmtCurrency = (value: string) => parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: royaltyResult.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const periodLabel = `${fmtDate(new Date(royaltyResult.period_start))} - ${fmtDate(new Date(royaltyResult.period_end))}`;
    const netPayable = parseFloat(royaltyResult.net_payable);
    const mailtoSubject = encodeURIComponent(`Royalty payment request ${periodLabel} for ${artist.name}`);
    const mailtoBody = encodeURIComponent(`Artist: ${artist.name}\nPeriod: ${periodLabel}\nAmount: ${fmtCurrency(royaltyResult.net_payable)}\n\nPlease provide your payment details:\n- Full name:\n- Bank name:\n- IBAN:\n- BIC/SWIFT:\n- Address:\n\nNote: If we already have your banking information on file, simply reply to confirm and we will process the payment to your existing account.`);
    const mailtoLink = `mailto:royalties@whalesrecords.com?subject=${mailtoSubject}&body=${mailtoBody}`;
    const labelHeaderHtml = labelSettings ? `<div class="label-header">${labelSettings.logo_base64 ? `<img src="${labelSettings.logo_base64}" alt="${labelSettings.label_name}" class="label-logo" />` : ''}<div class="label-info"><div class="label-name">${labelSettings.label_name}</div>${[labelSettings.address_line1, labelSettings.address_line2, [labelSettings.postal_code, labelSettings.city].filter(Boolean).join(' '), labelSettings.country, labelSettings.email].filter(Boolean).map(l => `<div>${l}</div>`).join('')}${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}${labelSettings.vat_number ? `<div class="legal">TVA: ${labelSettings.vat_number}</div>` : ''}</div></div>` : '';
    writePrintWindow(`<!DOCTYPE html><html><head><title>Artist Statement - ${artist.name}</title><style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:'Roboto',-apple-system,sans-serif;padding:40px;max-width:600px;margin:0 auto;background:white}.label-header{position:absolute;top:40px;right:40px;text-align:right}.label-logo{max-width:80px;max-height:50px;object-fit:contain;margin-bottom:8px}.label-info{font-size:11px;color:#4b5563;line-height:1.5}.label-name{font-size:14px;font-weight:600;color:#111827;margin-bottom:4px}.label-info .legal{color:#6b7280;font-size:10px;margin-top:4px}.main-content{margin-top:100px}h1{font-size:28px;margin-bottom:8px;color:#111827;font-weight:700}.artist-name{font-size:22px;color:#6E56CF;font-weight:600;margin-bottom:4px}.period{color:#6b7280;font-size:14px;margin-bottom:32px;padding:8px 16px;background:#f3f4f6;border-radius:20px;display:inline-block}.summary-table{width:100%;border-collapse:collapse;margin-bottom:32px;background:#fafafa;border-radius:16px;overflow:hidden}.summary-table td{padding:16px 20px;border-bottom:1px solid #e5e7eb}.summary-table .label{color:#6b7280;font-size:14px}.summary-table .value{text-align:right;font-size:16px;font-weight:600;color:#111827}.net-row td{border-bottom:none;padding-top:20px;background:linear-gradient(135deg,#6E56CF10 0%,#6E56CF05 100%)}.net-row .label{font-size:18px;font-weight:700;color:#111827}.net-row .value{font-size:26px;font-weight:700;color:#22c55e}.contact-section{margin-top:40px;padding:28px;background:linear-gradient(135deg,#6E56CF08 0%,#6E56CF15 100%);border-radius:20px;text-align:center;border:1px solid #6E56CF20}.contact-section h3{margin:0 0 8px 0;font-size:18px;color:#111827;font-weight:600}.contact-section p{margin:0 0 20px 0;font-size:14px;color:#6b7280}.contact-btn{display:inline-block;padding:14px 36px;background:#6E56CF;color:white;text-decoration:none;border-radius:50px;font-weight:600;font-size:14px;box-shadow:0 4px 14px rgba(110,86,207,0.35)}.footer{margin-top:48px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center}.footer-logo{max-width:100px;max-height:40px;margin:0 auto 8px;display:block;opacity:0.7}.footer-text{font-size:10px;color:#9ca3af}@media print{.contact-btn{background:#6E56CF!important}body{padding:20px}}</style></head><body>${labelHeaderHtml}<div class="main-content"><h1>Royalty Statement</h1><p class="artist-name">${artist.name}</p><p class="period">Period: ${periodLabel}</p><table class="summary-table"><tr><td class="label">Gross Revenue</td><td class="value">${fmtCurrency(royaltyResult.total_gross)}</td></tr><tr><td class="label">Your Royalties</td><td class="value">${fmtCurrency(royaltyResult.total_artist_royalties)}</td></tr><tr><td class="label">Advances Recouped</td><td class="value" style="color:#b45309;">-${fmtCurrency(royaltyResult.recoupable)}</td></tr><tr class="net-row"><td class="label">Net Payable to You</td><td class="value">${fmtCurrency(royaltyResult.net_payable)}</td></tr></table>${netPayable > 0 ? `<div class="contact-section"><h3>Ready to receive your payment?</h3><p>Click below to send us your payment details</p><a href="${mailtoLink}" class="contact-btn">Request Payment</a></div>` : `<div class="contact-section" style="background:linear-gradient(135deg,#6b728010 0%,#6b728015 100%);border-color:#6b728020;"><h3>No payment due at this time</h3><p>Your advances are still being recouped. Contact us if you have questions.</p><a href="mailto:royalties@whalesrecords.com" class="contact-btn" style="background:#6b7280;box-shadow:0 4px 14px rgba(107,114,128,0.25);">Contact Us</a></div>`}<div class="footer"><img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" /><div class="footer-text">Generated on ${fmtDate(new Date())} at ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})} by ${generatedByName}${labelSettings?.label_name ? ` - ${labelSettings.label_name}` : ''}</div></div></div></body></html>`);
  };

  return (
    <div className="space-y-6">
      {error && (<div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError(null)} className="ml-2 underline">Fermer</button></div>)}

      {/* Calcul Royalties */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider"><h2 className="font-semibold text-foreground">Calcul des royalties</h2></div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="flex-1 h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors">
              {PERIODS.map((period) => (<option key={period.value} value={period.value}>{period.label}</option>))}
            </select>
            <button onClick={handleCalculateRoyalties} disabled={calculatingRoyalties} className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl disabled:opacity-50 transition-all">{calculatingRoyalties ? 'Calcul...' : 'Calculer'}</button>
          </div>
          {royaltyError && (<div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm mb-4">{royaltyError}</div>)}
          {royaltyResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-content2 rounded-xl p-3"><p className="text-xs text-secondary-500">Brut total</p><p className="text-lg font-semibold text-foreground">{formatCurrency(royaltyResult.total_gross, royaltyResult.currency)}</p></div>
                <div className="bg-content2 rounded-xl p-3"><p className="text-xs text-secondary-500">Royalties artiste</p><p className="text-lg font-semibold text-foreground">{formatCurrency(royaltyResult.total_artist_royalties, royaltyResult.currency)}</p></div>
              </div>
              {parseFloat(royaltyResult.total_advances || '0') > 0 && (
                <div className="bg-warning-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-warning-800">Détail des avances</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-warning-700">Avances totales</span><span className="font-medium text-warning-900">{formatCurrency(royaltyResult.total_advances, royaltyResult.currency)}</span></div>
                    {parseFloat(royaltyResult.total_recouped_before || '0') > 0 && (<div className="flex justify-between"><span className="text-warning-700">Déjà recoupé</span><span className="font-medium text-success-700">-{formatCurrency(royaltyResult.total_recouped_before, royaltyResult.currency)}</span></div>)}
                    {parseFloat(royaltyResult.recoupable || '0') > 0 && (<div className="flex justify-between"><span className="text-warning-700">Recoupé cette période</span><span className="font-medium text-success-700">-{formatCurrency(royaltyResult.recoupable, royaltyResult.currency)}</span></div>)}
                    <div className="flex justify-between border-t border-warning-200 pt-1 mt-1"><span className="font-medium text-warning-800">Reste à recouper</span><span className="font-bold text-warning-900">{formatCurrency(royaltyResult.remaining_advance, royaltyResult.currency)}</span></div>
                  </div>
                </div>
              )}
              <div className={`rounded-xl p-4 ${parseFloat(royaltyResult.net_payable) > 0 ? 'bg-success-50' : 'bg-content2'}`}>
                <p className="text-xs text-secondary-500 mb-1">Net payable à l&apos;artiste</p>
                <p className={`text-2xl font-bold ${parseFloat(royaltyResult.net_payable) > 0 ? 'text-success-700' : 'text-foreground'}`}>{formatCurrency(royaltyResult.net_payable, royaltyResult.currency)}</p>
              </div>
              {paidQuarters.length > 0 && (
                <div className="bg-warning-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-warning-700">Trimestres deja payes cette annee</p>
                  {paidQuarters.map((pq, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="text-warning-800">{pq.quarter} (paye le {new Date(pq.date).toLocaleDateString('fr-FR')})</span><span className="font-medium text-warning-900">-{formatCurrency(pq.amount.toString(), royaltyResult.currency)}</span></div>))}
                  <div className="border-t border-warning-200 pt-2 flex justify-between"><span className="text-sm font-medium text-warning-800">Reste a payer</span><span className="text-lg font-bold text-success-700">{formatCurrency((parseFloat(royaltyResult.net_payable) - paidQuarters.reduce((sum, pq) => sum + pq.amount, 0)).toString(), royaltyResult.currency)}</span></div>
                </div>
              )}
              <p className="text-xs text-secondary-500 text-center">Période: {new Date(royaltyResult.period_start).toLocaleDateString('fr-FR')} - {new Date(royaltyResult.period_end).toLocaleDateString('fr-FR')}</p>
              {royaltyResult.sources && royaltyResult.sources.length > 0 && (
                <div className="border-t border-divider pt-4">
                  <h3 className="text-sm font-medium text-secondary-700 mb-3">Détail par source</h3>
                  <div className="space-y-2">
                    {royaltyResult.sources.map((source, idx) => (
                      <div key={`${source.source}-${idx}`} className="flex items-center justify-between gap-3 py-2 border-b border-default-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${source.source === 'tunecore' ? 'bg-primary/10 text-primary-700' : source.source === 'bandcamp' ? 'bg-success/10 text-success-700' : 'bg-content2 text-secondary-600'}`}>{source.source_label}</span>
                          <span className="text-xs text-secondary-500">{formatNumber(source.transaction_count)} transactions · {formatNumber(source.streams)} streams</span>
                        </div>
                        <div className="text-right"><p className="text-sm font-medium text-foreground">{formatCurrency(source.artist_royalties, royaltyResult.currency)}</p><p className="text-xs text-secondary-500">sur {formatCurrency(source.gross, royaltyResult.currency)}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {royaltyResult.albums.length > 0 && (
                <div className="border-t border-divider pt-4">
                  <h3 className="text-sm font-medium text-secondary-700 mb-3">Détail par album</h3>
                  <div className="space-y-2">
                    {royaltyResult.albums.map((album, idx) => {
                      const hasAdvance = parseFloat(album.advance_balance || '0') > 0;
                      const advanceBalance = parseFloat(album.advance_balance || '0');
                      const recoupable = parseFloat(album.recoupable || '0');
                      const netPayable = parseFloat(album.net_payable || album.artist_royalties);
                      const isIncludedInAlbum = !!album.included_in_upc;
                      const parentAlbum = isIncludedInAlbum ? royaltyResult.albums.find(a => a.upc === album.included_in_upc) : null;
                      return (
                        <div key={`${album.upc}-${idx}`} className={`flex items-start justify-between gap-3 py-2 border-b border-default-50 last:border-0 ${isIncludedInAlbum ? 'bg-warning-50 rounded-xl px-2' : ''}`}>
                          <div className="min-w-0 flex-1">
                            <p className={`font-medium text-sm truncate ${isIncludedInAlbum ? 'text-warning-700' : 'text-foreground'}`}>{album.release_title}</p>
                            <p className="text-xs text-secondary-400 font-mono">UPC: {album.upc}</p>
                            <p className="text-xs text-secondary-500">{album.track_count} track{album.track_count > 1 ? 's' : ''}{album.streams > 0 && ` · ${formatNumber(album.streams)} streams`}</p>
                            {album.sources && album.sources.length > 1 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {album.sources.map((src: { sale_type: string; source_label: string; gross: string; quantity: number }, si: number) => {
                                  const saleLabel = src.sale_type === 'stream' ? 'Streams' : src.sale_type === 'cd' ? 'CD' : src.sale_type === 'vinyl' ? 'Vinyl' : src.sale_type === 'k7' ? 'K7' : src.sale_type === 'digital' ? 'Digital' : src.sale_type;
                                  return (<span key={si} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${src.sale_type === 'stream' ? 'bg-primary/10 text-primary-700' : 'bg-warning/10 text-warning-700'}`}>{src.source_label} ({saleLabel}): {formatCurrency(src.gross, royaltyResult.currency)}{src.sale_type === 'stream' ? ` · ${formatNumber(src.quantity)} streams` : src.quantity > 0 ? ` · ${src.quantity} ventes` : ''}</span>);
                                })}
                              </div>
                            )}
                            {isIncludedInAlbum && parentAlbum && (<p className="text-xs text-warning-700 mt-1 font-medium">Inclus dans &quot;{parentAlbum.release_title}&quot;</p>)}
                            {hasAdvance && !isIncludedInAlbum && (<p className="text-xs text-warning-600 mt-1">Avance: {formatCurrency(advanceBalance, royaltyResult.currency)} → Déduit: {formatCurrency(recoupable, royaltyResult.currency)}</p>)}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {isIncludedInAlbum ? (<><p className="text-sm font-medium text-secondary-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p><p className="text-xs text-warning-700">Inclus dans album</p></>) : hasAdvance ? (<><p className="text-sm font-medium text-foreground">{formatCurrency(netPayable, royaltyResult.currency)}</p><p className="text-xs text-secondary-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p></>) : (<p className="text-sm font-medium text-foreground">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>)}
                            {!isIncludedInAlbum && (<p className="text-xs text-secondary-500">{formatPercent(parseFloat(album.artist_share || '0'))}% de {formatCurrency(album.gross, royaltyResult.currency)}</p>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {royaltyResult.albums.length === 0 && (<p className="text-center text-sm text-secondary-500 py-4">Aucune donnée pour cette période</p>)}
              {royaltyResult.albums.length > 0 && (
                <div className="pt-4 border-t border-divider space-y-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleExportCSV} className="flex-1"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>CSV</Button>
                    <Button size="sm" variant="secondary" onClick={handlePrintPDF} className="flex-1"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>Revenus</Button>
                    <Button size="sm" variant="secondary" onClick={handlePrintExpensesPDF} className="flex-1"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>Depenses</Button>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handlePrintArtistPDF} className="w-full"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>PDF Artiste (avec lien paiement)</Button>
                </div>
              )}
              <div className="pt-4 border-t border-divider">
                <Button size="sm" variant="primary" onClick={handlePublishStatement} loading={publishingStatement} className="w-full bg-primary hover:bg-primary-600"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Publier sur l&apos;Espace Artiste</Button>
                <p className="text-xs text-secondary-500 text-center mt-2">Envoie le relevé sur l&apos;espace artiste</p>
              </div>
              {(() => { const paidTotal = paidQuarters.reduce((sum, pq) => sum + pq.amount, 0); const remaining = parseFloat(royaltyResult.net_payable) - paidTotal; if (royaltyResult.albums.length > 0 && remaining > 0) { return (<div className="pt-4 border-t border-divider"><Button onClick={handleMarkAsPaid} loading={markingAsPaid} className="w-full bg-success hover:bg-success-600 text-white"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Marquer comme paye ({formatCurrency(remaining.toString(), royaltyResult.currency)})</Button><p className="text-xs text-secondary-500 text-center mt-2">Cree un versement et enregistre le paiement</p></div>); } return null; })()}
            </div>
          )}
        </div>
      </div>

      {/* Advances */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between"><div><h2 className="font-medium text-foreground">Avances</h2><p className="text-sm text-secondary-500">Par catalogue, album ou track</p></div><Button size="sm" onClick={() => setShowAdvanceForm(true)}>Ajouter</Button></div>
        {advances.length === 0 ? (<p className="px-4 py-6 text-center text-secondary-500">Aucune avance</p>) : (
          <div className="divide-y divide-divider">
            {advances.map((entry) => {
              const isAdvance = entry.entry_type === 'advance';
              const isDeleting = deletingAdvanceId === entry.id;
              return (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{isAdvance ? 'Avance' : 'Recoupement'}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${entry.scope === 'catalog' ? 'bg-content2 text-secondary-600' : entry.scope === 'release' ? 'bg-success/10 text-success-700' : 'bg-primary/10 text-primary-700'}`}>{entry.scope === 'catalog' ? 'Catalogue' : entry.scope === 'release' ? 'Album' : 'Track'}</span>
                        {entry.category && (<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary-700">{EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}</span>)}
                      </div>
                      {entry.scope !== 'catalog' && entry.scope_id && (<p className="text-sm text-secondary-600">{entry.scope === 'release' ? (releases.find(r => r.upc === entry.scope_id)?.release_title || entry.scope_id) : (tracks.find(t => t.isrc === entry.scope_id)?.track_title || entry.scope_id)}<span className="text-xs text-secondary-400 font-mono ml-2">({entry.scope_id})</span></p>)}
                      {entry.description && (<p className="text-sm text-secondary-500">{entry.description}</p>)}
                      <p className="text-xs text-secondary-400 mt-1">{new Date(entry.effective_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${isAdvance ? 'text-danger' : 'text-success'}`}>{isAdvance ? '-' : '+'}{formatCurrency(entry.amount, entry.currency)}</p>
                      <button onClick={() => handleEditAdvance(entry)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      <button onClick={() => handleDeleteAdvance(entry.id)} disabled={isDeleting} className="p-1.5 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded transition-colors" title="Supprimer">{isDeleting ? (<div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />) : (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>)}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between"><div><h2 className="font-medium text-foreground">Versements</h2><p className="text-sm text-secondary-500">Royalties payées à l&apos;artiste</p></div><Button size="sm" onClick={() => setShowPaymentForm(true)}>Ajouter</Button></div>
        {payments.length === 0 ? (<p className="px-4 py-6 text-center text-secondary-500">Aucun versement</p>) : (
          <div className="divide-y divide-divider">
            {payments.map((payment) => {
              const isDeleting = deletingPaymentId === payment.id;
              return (
                <div key={payment.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0"><p className="font-medium text-foreground">Versement</p>{payment.description && (<p className="text-sm text-secondary-500">{payment.description}</p>)}<p className="text-xs text-secondary-400 mt-1">{new Date(payment.effective_date).toLocaleDateString('fr-FR')}</p></div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-success">{formatCurrency(payment.amount, payment.currency)}</p>
                      <button onClick={() => handleEditPayment(payment)} className="p-1.5 text-secondary-400 hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Modifier"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      <button onClick={() => handleDeletePayment(payment.id)} disabled={isDeleting} className="p-1.5 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded transition-colors" title="Supprimer">{isDeleting ? (<div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />) : (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>)}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Modifier le versement</h2><button onClick={() => setEditingPayment(null)} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4">
              <div><label className="block text-sm font-medium text-foreground mb-2">Montant (EUR)</label><Input type="number" value={editPaymentAmount} onChange={(e) => setEditPaymentAmount(e.target.value)} placeholder="1000.00" /></div>
              <div><label className="block text-sm font-medium text-foreground mb-2">Description</label><Input value={editPaymentDescription} onChange={(e) => setEditPaymentDescription(e.target.value)} placeholder="Versement Q3 2024" /></div>
              <div><label className="block text-sm font-medium text-foreground mb-2">Date</label><Input type="date" value={editPaymentDate} onChange={(e) => setEditPaymentDate(e.target.value)} /></div>
              <Button onClick={handleUpdatePayment} loading={savingPayment} disabled={!editPaymentAmount} className="w-full">Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Form Modal */}
      {showAdvanceForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Nouvelle avance</h2><button onClick={() => { setShowAdvanceForm(false); setAdvanceScope('catalog'); setAdvanceScopeId(''); }} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input type="number" label="Montant (EUR)" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="5000" />
              <div><label className="block text-sm font-medium text-secondary-700 mb-2">Appliquer à</label><div className="flex gap-2"><button type="button" onClick={() => { setAdvanceScope('catalog'); setAdvanceScopeId(''); }} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${advanceScope === 'catalog' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Catalogue</button><button type="button" onClick={() => setAdvanceScope('release')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${advanceScope === 'release' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Album</button><button type="button" onClick={() => setAdvanceScope('track')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${advanceScope === 'track' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Track</button></div></div>
              {advanceScope === 'release' && (<div><label className="block text-sm font-medium text-secondary-700 mb-2">Sélectionner un album</label><select value={advanceScopeId} onChange={(e) => setAdvanceScopeId(e.target.value)} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary"><option value="">-- Choisir un album --</option>{releases.map((r) => (<option key={r.upc} value={r.upc}>{r.release_title} ({r.upc})</option>))}</select></div>)}
              {advanceScope === 'track' && (<div><label className="block text-sm font-medium text-secondary-700 mb-2">Sélectionner un track</label><select value={advanceScopeId} onChange={(e) => setAdvanceScopeId(e.target.value)} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary"><option value="">-- Choisir un track --</option>{tracks.map((t) => (<option key={t.isrc} value={t.isrc}>{t.track_title} ({t.isrc})</option>))}</select></div>)}
              <div><label className="block text-sm font-medium text-secondary-700 mb-2">Catégorie</label><select value={advanceCategory} onChange={(e) => setAdvanceCategory(e.target.value as ExpenseCategory | '')} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-background"><option value="">-- Choisir une catégorie --</option>{EXPENSE_CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}</select></div>
              <Input type="date" label="Date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
              <Input label="Description (optionnel)" value={advanceDescription} onChange={(e) => setAdvanceDescription(e.target.value)} placeholder="Avance album 2025" />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3"><Button variant="secondary" onClick={() => { setShowAdvanceForm(false); setAdvanceScope('catalog'); setAdvanceScopeId(''); setAdvanceCategory(''); setAdvanceDate(''); }} className="flex-1">Annuler</Button><Button onClick={handleCreateAdvance} loading={creatingAdvance} disabled={!advanceAmount || (advanceScope !== 'catalog' && !advanceScopeId)} className="flex-1">Créer</Button></div>
          </div>
        </div>
      )}

      {/* Edit Advance Modal */}
      {editingAdvance && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Modifier l&apos;avance</h2><button onClick={() => setEditingAdvance(null)} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input type="number" label="Montant (EUR)" value={editAdvanceAmount} onChange={(e) => setEditAdvanceAmount(e.target.value)} placeholder="5000" />
              <div><label className="block text-sm font-medium text-secondary-700 mb-2">Appliquer à</label><div className="flex gap-2"><button type="button" onClick={() => { setEditAdvanceScope('catalog'); setEditAdvanceScopeId(''); }} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${editAdvanceScope === 'catalog' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Catalogue</button><button type="button" onClick={() => setEditAdvanceScope('release')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${editAdvanceScope === 'release' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Album</button><button type="button" onClick={() => setEditAdvanceScope('track')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${editAdvanceScope === 'track' ? 'bg-foreground text-background' : 'bg-content2 text-secondary-600 hover:bg-content3'}`}>Track</button></div></div>
              {editAdvanceScope === 'release' && (<div><label className="block text-sm font-medium text-secondary-700 mb-2">Sélectionner un album</label><select value={editAdvanceScopeId} onChange={(e) => setEditAdvanceScopeId(e.target.value)} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary"><option value="">-- Choisir un album --</option>{releases.map((r) => (<option key={r.upc} value={r.upc}>{r.release_title} ({r.upc})</option>))}</select></div>)}
              {editAdvanceScope === 'track' && (<div><label className="block text-sm font-medium text-secondary-700 mb-2">Sélectionner un track</label><select value={editAdvanceScopeId} onChange={(e) => setEditAdvanceScopeId(e.target.value)} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary"><option value="">-- Choisir un track --</option>{tracks.map((t) => (<option key={t.isrc} value={t.isrc}>{t.track_title} ({t.isrc})</option>))}</select></div>)}
              <div><label className="block text-sm font-medium text-secondary-700 mb-2">Catégorie</label><select value={editAdvanceCategory} onChange={(e) => setEditAdvanceCategory(e.target.value as ExpenseCategory | '')} className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-background"><option value="">-- Choisir une catégorie --</option>{EXPENSE_CATEGORIES.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}</select></div>
              <Input type="date" label="Date" value={editAdvanceDate} onChange={(e) => setEditAdvanceDate(e.target.value)} />
              <Input label="Description (optionnel)" value={editAdvanceDescription} onChange={(e) => setEditAdvanceDescription(e.target.value)} placeholder="Avance album 2025" />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3"><Button variant="secondary" onClick={() => setEditingAdvance(null)} className="flex-1">Annuler</Button><Button onClick={handleUpdateAdvance} loading={savingAdvance} disabled={!editAdvanceAmount || (editAdvanceScope !== 'catalog' && !editAdvanceScopeId)} className="flex-1">Enregistrer</Button></div>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Nouveau versement</h2><button onClick={() => setShowPaymentForm(false)} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input type="number" label="Montant (EUR)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="1000" />
              <Input type="date" label="Date du versement" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              <Input label="Description (optionnel)" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} placeholder="Versement Q3 2024" />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3"><Button variant="secondary" onClick={() => setShowPaymentForm(false)} className="flex-1">Annuler</Button><Button onClick={handleCreatePayment} loading={creatingPayment} disabled={!paymentAmount} className="flex-1">Créer</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
