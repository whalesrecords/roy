'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import {
  getPlatformStats, getQuarterlyRevenue, getAvailableYears, getStatements,
  PlatformStats, QuarterlyRevenue, Statement,
} from '@/lib/api';
import {
  ComposedChart, Area, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Card, Eyebrow, Pill, Segmented, Sparkline, fmtMoney, fmtNum, fmtPct, platformColor,
} from '@/components/roy/ui';
import { IconTrendUp, IconDownload, IconCalendar } from '@/components/roy/icons';

export default function StatsPage() {
  const { artist, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist) return;
    getAvailableYears()
      .then((d) => {
        const ys = d.years.length ? d.years : [new Date().getFullYear()];
        setYears(ys);
        setYear((y) => (y === 0 ? d.default_year || ys[0] : y));
      })
      .catch(() => {
        const y = new Date().getFullYear();
        setYears([y]); setYear((p) => p || y);
      });
    getStatements().then(setStatements).catch(() => {});
  }, [artist]);

  useEffect(() => {
    if (!artist || year === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [p, q] = await Promise.all([getPlatformStats(year), getQuarterlyRevenue(year)]);
        if (cancelled) return;
        setStats(p);
        setQuarterly(q.filter((x) => parseFloat(x.gross) > 0 || x.streams > 0));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artist, year]);

  const currency = quarterly[0]?.currency || 'EUR';
  const totalGross = stats.reduce((s, p) => s + parseFloat(p.gross), 0);
  const totalStreams = stats.reduce((s, p) => s + p.streams, 0);
  const totalNet = quarterly.reduce((s, q) => s + parseFloat(q.net), 0);
  const unpaid = statements.filter((s) => s.status !== 'paid').reduce((s, x) => s + parseFloat(x.net_payable), 0);

  const sorted = useMemo(() => [...stats].sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross)), [stats]);
  const maxGross = sorted.length ? parseFloat(sorted[0].gross) : 0;

  const growth = useMemo(() => {
    if (quarterly.length < 2) return null;
    const f = parseFloat(quarterly[0].gross);
    const l = parseFloat(quarterly[quarterly.length - 1].gross);
    if (f <= 0) return null;
    return ((l - f) / f) * 100;
  }, [quarterly]);

  const trendData = quarterly.map((q) => ({ name: q.quarter, gross: parseFloat(q.gross), net: parseFloat(q.net) }));
  const sparkPoints = quarterly.map((q) => parseFloat(q.gross));

  // Donut segments
  const donut = useMemo(() => {
    if (!totalGross) return { gradient: 'var(--track)', legend: [] as { label: string; color: string; pct: number }[] };
    let acc = 0;
    const segs = sorted.map((s) => {
      const pct = s.percentage || (parseFloat(s.gross) / totalGross) * 100;
      const start = acc * 3.6;
      acc += pct;
      const end = acc * 3.6;
      return { color: platformColor(s.platform), start, end, pct, label: s.platform_label };
    });
    const gradient = `conic-gradient(${segs.map((x) => `${x.color} ${x.start.toFixed(1)}deg ${x.end.toFixed(1)}deg`).join(',')})`;
    const top = segs.slice(0, 4).map((s) => ({ label: s.label, color: s.color, pct: s.pct }));
    const others = segs.slice(4).reduce((sum, s) => sum + s.pct, 0);
    if (others > 0) top.push({ label: 'Autres', color: 'var(--text-3)', pct: others });
    return { gradient, legend: top };
  }, [sorted, totalGross]);

  const exportCsv = () => {
    const rows = [['Plateforme', 'Revenus', 'Streams', 'Part %']];
    sorted.forEach((s) => rows.push([s.platform_label, parseFloat(s.gross).toFixed(2), String(s.streams), (s.percentage || 0).toFixed(1)]));
    const csv = rows.map((r) => r.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `stats-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const yearOpts = years.map((y) => ({ value: y, label: String(y) }));

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-app"><Spinner size="lg" color="primary" /></div>;
  }

  const trendLegend = (
    <div className="flex gap-3.5">
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted"><span className="w-2 h-2 rounded-full bg-accent" />Brut</span>
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted"><span className="w-2 h-2 rounded-full bg-ink-faint" />Net</span>
    </div>
  );

  const trendChart = (h: number) => (
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={trendData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gGrossA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
          formatter={(v: number, n) => [fmtMoney(v, currency), n === 'gross' ? 'Brut' : 'Net']}
        />
        <Area type="monotone" dataKey="gross" stroke="var(--accent)" strokeWidth={2} fill="url(#gGrossA)" dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="net" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Statistiques</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Performance {year || ''} · toutes plateformes</div>
        </div>
        <div className="flex items-center gap-3">
          {yearOpts.length > 0 && <Segmented options={yearOpts} value={year} onChange={setYear} />}
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-[11px] border border-line-strong bg-surface px-3.5 py-2.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2 transition-colors">
            <IconDownload size={15} /> Exporter
          </button>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {error && <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>}

        {/* Mobile year segmented */}
        {yearOpts.length > 0 && <div className="lg:hidden"><Segmented options={yearOpts} value={year} onChange={setYear} fill /></div>}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" color="primary" /></div>
        ) : stats.length === 0 ? (
          <div className="text-center py-16 text-ink-faint">Aucune donnée pour {year}</div>
        ) : (<>
          {/* ── Mobile hero ── */}
          <Card hero padded className="lg:hidden rounded-hero p-5 overflow-hidden">
            <div className="flex items-center justify-between">
              <Eyebrow>Revenus bruts · {year}</Eyebrow>
              {growth != null && <Pill><IconTrendUp size={11} /> {fmtPct(growth, true)}</Pill>}
            </div>
            <div className="roy-num text-[44px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalGross, currency)}</div>
            <div className="text-[12.5px] text-ink-muted mt-2.5">Net royalties <span className="text-ink font-semibold roy-num">{fmtMoney(totalNet, currency)}</span></div>
            {sparkPoints.length > 1 && <Sparkline points={sparkPoints} height={40} className="mt-3" />}
          </Card>

          {/* ── Mobile 2 KPI ── */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">
            <Card><Eyebrow className="text-[9.5px]">Streams</Eyebrow><div className="roy-num text-[23px] font-bold text-ink mt-1.5">{fmtNum(totalStreams)}</div></Card>
            <Card><Eyebrow className="text-[9.5px]">Net royalties</Eyebrow><div className="roy-num text-[23px] font-bold text-ink mt-1.5">{fmtMoney(totalNet, currency)}</div></Card>
          </div>

          {/* ── Mobile prochain versement ── */}
          {unpaid > 0 && (
            <Card className="lg:hidden flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0"><IconCalendar size={19} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink">Prochain versement</div>
                <div className="text-[11.5px] text-ink-faint mt-0.5">En attente · SEPA</div>
              </div>
              <div className="text-right">
                <div className="roy-num text-[16px] font-bold text-ink">{fmtMoney(unpaid, currency)}</div>
                <div className="text-[10px] font-semibold text-accent mt-0.5">À venir</div>
              </div>
            </Card>
          )}

          {/* ── Desktop 4 KPI ── */}
          <div className="hidden lg:grid grid-cols-4 gap-4">
            <Card hero>
              <div className="flex items-center justify-between">
                <Eyebrow className="text-[9.5px]">Revenus bruts</Eyebrow>
                {growth != null && <Pill><IconTrendUp size={10} /> {fmtPct(growth, true)}</Pill>}
              </div>
              <div className="roy-num text-[29px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalGross, currency)}</div>
              {sparkPoints.length > 1 && <Sparkline points={sparkPoints} height={26} filled={false} className="mt-3" />}
            </Card>
            <Card>
              <Eyebrow className="text-[9.5px]">Net royalties</Eyebrow>
              <div className="roy-num text-[29px] font-bold text-ink leading-none mt-2.5">{fmtMoney(totalNet, currency)}</div>
              <div className="text-[12px] text-ink-muted mt-3">{totalGross ? Math.round((totalNet / totalGross) * 100) : 0} % du brut</div>
            </Card>
            <Card>
              <Eyebrow className="text-[9.5px]">Streams</Eyebrow>
              <div className="roy-num text-[29px] font-bold text-ink leading-none mt-2.5">{fmtNum(totalStreams)}</div>
              <div className="text-[12px] text-ink-muted mt-3">{sorted.length} plateformes</div>
            </Card>
            <Card>
              <Eyebrow className="text-[9.5px]">Prochain versement</Eyebrow>
              <div className="roy-num text-[29px] font-bold text-ink leading-none mt-2.5">{fmtMoney(unpaid, currency)}</div>
              <div className="text-[12px] text-ink-muted mt-3"><span className="text-accent font-semibold">à venir</span> · SEPA</div>
            </Card>
          </div>

          {/* ── Mobile platform bars ── */}
          <Card className="lg:hidden p-[18px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-ink">Revenus par plateforme</span>
              <span className="text-[11px] text-ink-faint">{sorted.length} sources</span>
            </div>
            <div className="flex flex-col gap-3.5">
              {sorted.slice(0, 6).map((s) => {
                const rev = parseFloat(s.gross);
                const w = maxGross ? (rev / maxGross) * 100 : 0;
                const color = platformColor(s.platform);
                return (
                  <div key={s.platform}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink"><span className="w-2 h-2 rounded-[3px]" style={{ background: color }} />{s.platform_label}</span>
                      <span className="roy-num text-[12.5px] font-semibold text-ink">{fmtMoney(rev, currency)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-track overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Mobile trend ── */}
          {trendData.length > 0 && (
            <Card className="lg:hidden p-[18px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-semibold text-ink">Tendance des revenus</span>
                {trendLegend}
              </div>
              {trendChart(140)}
            </Card>
          )}

          {/* ── Desktop charts row ── */}
          <div className="hidden lg:grid grid-cols-[1.55fr_1fr] gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[14px] font-semibold text-ink">Tendance des revenus</span>
                {trendLegend}
              </div>
              {trendChart(220)}
            </Card>
            <Card className="p-5">
              <span className="text-[14px] font-semibold text-ink">Répartition</span>
              <div className="flex items-center gap-[18px] mt-3.5">
                <div className="relative w-32 h-32 shrink-0 rounded-full" style={{ background: donut.gradient }}>
                  <div className="absolute inset-[18px] rounded-full bg-surface flex flex-col items-center justify-center">
                    <span className="roy-num text-[16px] font-bold text-ink">{fmtMoney(totalGross, currency, { notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
                    <span className="text-[9.5px] text-ink-faint">total</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                  {donut.legend.map((l) => (
                    <div key={l.label} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 text-ink"><span className="w-2 h-2 rounded-[3px]" style={{ background: l.color }} />{l.label}</span>
                      <span className="roy-num text-ink-muted">{fmtPct(l.pct)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ── Desktop table ── */}
          <Card padded={false} className="hidden lg:block overflow-hidden">
            <div className="px-[22px] py-4 border-b border-line text-[14px] font-semibold text-ink">Détail par plateforme</div>
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr] px-[22px] py-[11px] border-b border-line roy-eyebrow text-[10px]">
              <span>Plateforme</span><span className="text-right">Revenus</span><span className="text-right">Streams</span><span className="text-right">Part</span>
            </div>
            {sorted.map((s) => {
              const pct = s.percentage || (totalGross ? (parseFloat(s.gross) / totalGross) * 100 : 0);
              return (
                <div key={s.platform} className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr] items-center px-[22px] py-3.5 border-b border-line hover:bg-surface-2 transition-colors">
                  <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: platformColor(s.platform) }} />{s.platform_label}</span>
                  <span className="text-right roy-num text-[13px] font-semibold text-ink">{fmtMoney(s.gross, currency)}</span>
                  <span className="text-right roy-num text-[13px] text-ink-muted">{fmtNum(s.streams)}</span>
                  <span className="flex items-center gap-2.5 justify-end">
                    <span className="flex-1 max-w-[90px] h-[5px] rounded-full bg-track overflow-hidden"><span className="block h-full bg-accent" style={{ width: `${pct}%` }} /></span>
                    <span className="roy-num text-[12px] text-ink-muted w-[42px] text-right">{fmtPct(pct)}</span>
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr] items-center px-[22px] py-3.5 bg-surface-2">
              <span className="text-[13px] font-bold text-ink">Total</span>
              <span className="text-right roy-num text-[13px] font-bold text-ink">{fmtMoney(totalGross, currency)}</span>
              <span className="text-right roy-num text-[13px] font-semibold text-ink">{fmtNum(totalStreams)}</span>
              <span className="text-right roy-num text-[12px] font-semibold text-ink-muted">100 %</span>
            </div>
          </Card>
        </>)}
      </main>
    </div>
  );
}
