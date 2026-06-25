import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money, Sparkline } from '@/components/ui';
import { Screen, State, SectionTitle, BarRow } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getAnalyticsSummary, getImports } from '@/lib/api';
import { fmtMoney, fmtNum, fmtDateLong, fmtDateShort } from '@/lib/format';
import { maybeNotifyImportReminder } from '@/lib/notifications';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'neg' }) {
  const p = usePalette();
  const color = tone === 'accent' ? p.accent : tone === 'neg' ? p.neg : p.text;
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 21, fontWeight: '800', marginTop: 6, color }}>{value}</Money>
    </Card>
  );
}

/** Last CSV import freshness: green <1mo, yellow ≥1mo, orange ≥2mo, red ≥3mo. */
function ImportStatusCard() {
  const p = usePalette();
  const { t } = useLanguage();
  const { data } = useFetch(() => getImports(20), [], 'imports');
  const last = data && data.length ? data[0] : null;

  React.useEffect(() => {
    if (!last) return;
    const days = (Date.now() - new Date(last.created_at).getTime()) / 86_400_000;
    const months = Math.floor(days / 30.44);
    maybeNotifyImportReminder(months, fmtDateLong(last.created_at));
  }, [last]);

  if (!data) return null;

  if (!last) {
    return (
      <Card>
        <Eyebrow>{t('home.lastImport')}</Eyebrow>
        <Text style={{ color: p.text3, fontSize: 13.5, marginTop: 8 }}>{t('home.noImport')}</Text>
      </Card>
    );
  }

  const days = (Date.now() - new Date(last.created_at).getTime()) / 86_400_000;
  const { color, label } =
    days < 30 ? { color: p.accent, label: t('home.importUpToDate') }
    : days < 60 ? { color: '#E3B341', label: t('home.importSoon') }
    : days < 90 ? { color: '#E8833A', label: t('home.importLate') }
    : { color: p.neg, label: t('home.importVeryLate') };
  const stale = days >= 30;

  return (
    <Card style={{ borderColor: stale ? color : p.border, borderWidth: stale ? 1.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>{t('home.lastImport')}</Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color }} />
          <Text style={{ color, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</Text>
        </View>
      </View>
      <Text style={{ color: p.text, fontSize: 17, fontWeight: '800', marginTop: 6 }}>{fmtDateLong(last.created_at)}</Text>
      <Text style={{ color: p.text3, fontSize: 12, marginTop: 3 }}>
        {t('home.importPeriod')} : {fmtDateShort(last.period_start)} – {fmtDateShort(last.period_end)}
        {last.source ? `  ·  ${last.source}` : ''}
      </Text>
      {stale ? (
        <View style={{ marginTop: 10, backgroundColor: `${color}1A`, borderRadius: 10, padding: 10 }}>
          <Text style={{ color, fontSize: 12.5, fontWeight: '600' }}>{t('home.importReminder')}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function DashboardScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [year, setYear] = useState(CURRENT_YEAR);
  const { data, loading, error, reload } = useFetch(() => getAnalyticsSummary(year), [year], `analytics:${year}`);

  const cur = data?.currency || 'EUR';
  const sources = [...(data?.revenue_by_source || [])].sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross)).slice(0, 6);
  const cats = [...(data?.expenses_by_category || [])].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 6);
  const maxSource = sources.reduce((m, s) => Math.max(m, parseFloat(s.gross) || 0), 0) || 1;
  const maxCat = cats.reduce((m, c) => Math.max(m, parseFloat(c.amount) || 0), 0) || 1;
  const monthly = (data?.monthly_revenue || []).map((m) => parseFloat(m.gross) || 0);

  return (
    <Screen title={t('home.title')} onRefresh={reload} refreshing={loading}>
      {/* Year selector */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {YEARS.map((y) => (
          <Pressable
            key={y}
            onPress={() => setYear(y)}
            style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: year === y ? p.accent : p.surface2, borderColor: year === y ? p.accent : p.border, borderWidth: 1 }}
          >
            <Text style={{ color: year === y ? p.accentInk : p.text2, fontSize: 13, fontWeight: '700' }}>{y}</Text>
          </Pressable>
        ))}
      </View>

      <ImportStatusCard />

      <State loading={loading} error={error} onRetry={reload}>
        {data ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Kpi label={t('home.revenue')} value={fmtMoney(data.total_revenue, cur)} tone="accent" />
              <Kpi label={t('home.net')} value={fmtMoney(data.net, cur)} tone={parseFloat(data.net) < 0 ? 'neg' : undefined} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Kpi label={t('home.expenses')} value={fmtMoney(data.total_expenses, cur)} />
              <Kpi label={t('home.payable')} value={fmtMoney(data.total_royalties_payable, cur)} />
            </View>

            {monthly.length >= 2 ? (
              <Card>
                <Eyebrow>{t('home.monthly')}</Eyebrow>
                <View style={{ marginTop: 12, alignItems: 'stretch' }}>
                  <Sparkline points={monthly} width={300} height={44} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: p.text3, fontSize: 11 }}>{data.monthly_revenue[0]?.month_label}</Text>
                  <Text style={{ color: p.text3, fontSize: 11 }}>{data.monthly_revenue[data.monthly_revenue.length - 1]?.month_label}</Text>
                </View>
              </Card>
            ) : null}

            {sources.length ? (
              <Card>
                <SectionTitle>{t('home.bySource')}</SectionTitle>
                {sources.map((s) => (
                  <BarRow
                    key={s.source}
                    label={s.source_label || s.source}
                    value={fmtMoney(s.gross, cur)}
                    pct={(parseFloat(s.gross) / maxSource) * 100}
                    sub={`${fmtNum(s.transaction_count)} transactions`}
                  />
                ))}
              </Card>
            ) : null}

            {cats.length ? (
              <Card>
                <SectionTitle>{t('home.byCategory')}</SectionTitle>
                {cats.map((c) => (
                  <BarRow
                    key={c.category}
                    label={c.category_label || c.category}
                    value={fmtMoney(c.amount, cur)}
                    pct={(parseFloat(c.amount) / maxCat) * 100}
                  />
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </State>
    </Screen>
  );
}
