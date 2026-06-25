import React from 'react';
import { View, Text } from 'react-native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money, Sparkline } from '@/components/ui';
import { Screen, State, SectionTitle, BarRow } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getAnalyticsSummary } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

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

export default function DashboardScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const { data, loading, error, reload } = useFetch(getAnalyticsSummary, [], 'analytics');

  const cur = data?.currency || 'EUR';
  const sources = [...(data?.revenue_by_source || [])].sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross)).slice(0, 6);
  const cats = [...(data?.expenses_by_category || [])].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 6);
  const maxSource = sources.reduce((m, s) => Math.max(m, parseFloat(s.gross) || 0), 0) || 1;
  const maxCat = cats.reduce((m, c) => Math.max(m, parseFloat(c.amount) || 0), 0) || 1;
  const monthly = (data?.monthly_revenue || []).map((m) => parseFloat(m.gross) || 0);

  return (
    <Screen title={t('home.title')} onRefresh={reload} refreshing={loading}>
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
