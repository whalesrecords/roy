import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { getArtistPayments, invalidateCache, ArtistPayment } from '@/lib/api';
import { Card, Money, Loader } from '@/components/ui';
import { IconOutflow } from '@/components/icons';
import { fmtMoney, fmtDateLong } from '@/lib/format';

export default function PaymentsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setPayments(await getArtistPayments());
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);
  const onRefresh = async () => { setRefreshing(true); invalidateCache('/artist-portal/payments'); try { await load(); } finally { setRefreshing(false); } };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  const total = payments.reduce((s, x) => s + parseFloat(x.amount), 0);
  const currency = payments[0]?.currency || 'EUR';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('payments.title')}</Text>
        <Card>
          <Text style={{ color: p.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Total versé</Text>
          <Money style={{ fontSize: 30, fontWeight: '800', marginTop: 6 }}>{fmtMoney(total, currency)}</Money>
          <Text style={{ color: p.text3, fontSize: 12, marginTop: 4 }}>{payments.length} versement{payments.length > 1 ? 's' : ''}</Text>
        </Card>

        {payments.length === 0 ? (
          <Text style={{ color: p.text3, textAlign: 'center', paddingVertical: 32 }}>Aucun versement</Text>
        ) : (
          <Card style={{ padding: 0 }}>
            {payments.map((pm, i) => (
              <View key={pm.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: p.border, borderBottomWidth: i < payments.length - 1 ? 1 : 0 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface2 }}>
                  <IconOutflow size={18} color={p.text2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{pm.description || 'Versement SEPA'}</Text>
                  <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{fmtDateLong(pm.date)}</Text>
                </View>
                <Money style={{ fontSize: 14, fontWeight: '700' }}>{fmtMoney(pm.amount, pm.currency)}</Money>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
