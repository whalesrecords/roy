import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money, Cover } from '@/components/ui';
import { State, SectionTitle, Divider, StatusBadge } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getInventorySummary, getProducts, Product } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'neg' | 'accent' }) {
  const p = usePalette();
  const color = tone === 'neg' ? p.neg : tone === 'accent' ? p.accent : p.text;
  return (
    <Card style={{ flex: 1, minWidth: 110 }}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 18, fontWeight: '800', marginTop: 5, color }}>{value}</Money>
    </Card>
  );
}

export default function InventoryScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const sumQ = useFetch(getInventorySummary, [], 'inv-summary');
  const prodQ = useFetch(getProducts, [], 'products');

  React.useEffect(() => { nav.setOptions?.({ title: t('inventory.title') }); }, [nav, t]);

  const sum = sumQ.data;
  const products = (prodQ.data || []).slice(0, 40);

  const stockTone = (pr: Product) =>
    pr.stock_quantity <= 0 ? 'bad' : pr.stock_quantity <= pr.low_stock_threshold ? 'warn' : 'good';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={sumQ.loading} error={sumQ.error} onRetry={sumQ.reload}>
          {sum ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <Kpi label={t('inventory.products')} value={fmtNum(sum.total_products)} />
                <Kpi label={t('inventory.stock')} value={fmtNum(sum.total_stock)} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <Kpi label={t('inventory.lowStock')} value={fmtNum(sum.low_stock_count)} tone={sum.low_stock_count > 0 ? 'neg' : undefined} />
                <Kpi label={t('inventory.value')} value={fmtMoney(sum.total_value, 'EUR')} tone="accent" />
              </View>
            </>
          ) : null}
        </State>

        <Card>
          <SectionTitle>{t('inventory.products')}</SectionTitle>
          <State loading={prodQ.loading} error={prodQ.error} onRetry={prodQ.reload} empty={!!prodQ.data && products.length === 0}>
            <View style={{ marginTop: 4 }}>
              {products.map((pr, i) => (
                <View key={pr.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12 }}>
                    <Cover size={42} uri={pr.image_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{pr.title}</Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                        {[pr.format, pr.variant, pr.artist_name].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <StatusBadge label={`${fmtNum(pr.stock_quantity)} en stock`} tone={stockTone(pr)} />
                      <Text style={{ color: p.text3, fontSize: 10.5 }}>{fmtNum(pr.total_sold)} {t('inventory.sold')}</Text>
                    </View>
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
