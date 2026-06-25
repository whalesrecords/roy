import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money } from '@/components/ui';
import { State, SectionTitle, Divider, StatusBadge } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getFinancesSummary, getExpenses, getRoyaltyPayments } from '@/lib/api';
import { fmtMoney, fmtDateShort } from '@/lib/format';

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'neg' | 'accent' }) {
  const p = usePalette();
  const color = tone === 'neg' ? p.neg : tone === 'accent' ? p.accent : p.text;
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 20, fontWeight: '800', marginTop: 6, color }}>{value}</Money>
    </Card>
  );
}

export default function FinancesScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const sumQ = useFetch(getFinancesSummary);
  const expQ = useFetch(getExpenses);
  const payQ = useFetch(getRoyaltyPayments);

  React.useEffect(() => { nav.setOptions?.({ title: t('finances.title') }); }, [nav, t]);

  const sum = sumQ.data;
  const cur = sum?.currency || 'EUR';
  const expenses = (expQ.data || []).slice(0, 12);
  const payments = (payQ.data || []).slice(0, 10);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={sumQ.loading} error={sumQ.error} onRetry={sumQ.reload}>
          {sum ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Kpi label={t('finances.totalExpenses')} value={fmtMoney(sum.total_expenses, cur)} tone="neg" />
              <Kpi label={t('finances.totalPayable')} value={fmtMoney(sum.total_royalties_payable, cur)} tone="accent" />
            </View>
          ) : null}
        </State>

        <Card>
          <SectionTitle>{t('finances.payments')}</SectionTitle>
          <State loading={payQ.loading} error={payQ.error} onRetry={payQ.reload} empty={!!payQ.data && payments.length === 0}>
            <View style={{ marginTop: 4 }}>
              {payments.map((r, i) => (
                <View key={r.run_id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }}>
                        {fmtDateShort(r.period_start)} – {fmtDateShort(r.period_end)}
                      </Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{r.artists_count} artistes</Text>
                    </View>
                    <StatusBadge label={r.status} tone={r.locked_at ? 'good' : 'neutral'} />
                    <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent, marginLeft: 8 }}>
                      {fmtMoney(r.total_net_payable, cur)}
                    </Money>
                  </View>
                </View>
              ))}
            </View>
          </State>
        </Card>

        <Card>
          <SectionTitle>{t('finances.expenses')}</SectionTitle>
          <State loading={expQ.loading} error={expQ.error} onRetry={expQ.reload} empty={!!expQ.data && expenses.length === 0}>
            <View style={{ marginTop: 4 }}>
              {expenses.map((e, i) => (
                <View key={e.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                        {e.description || e.category_label || e.category || '—'}
                      </Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>
                        {[e.artist_name || e.scope_title, fmtDateShort(e.effective_date)].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.neg }}>{fmtMoney(e.amount, e.currency)}</Money>
                  </View>
                </View>
              ))}
            </View>
          </State>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
