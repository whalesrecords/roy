import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money } from '@/components/ui';
import { State, SectionTitle, StatusBadge, Divider } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getRoyaltyRun } from '@/lib/api';
import { fmtMoney, fmtNum, fmtDateLong } from '@/lib/format';

export default function RunDetailScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params || {};
  const { data: r, loading, error, reload } = useFetch(() => getRoyaltyRun(id), [id], `run:${id}`);

  React.useEffect(() => { nav.setOptions?.({ title: t('royalties.detail') }); }, [nav, t]);

  const cur = r?.base_currency || 'EUR';
  const artists = r ? [...r.artists].sort((a, b) => parseFloat(b.net_payable) - parseFloat(a.net_payable)) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={loading} error={error} onRetry={reload}>
          {r ? (
            <>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Eyebrow>{t('royalties.period')}</Eyebrow>
                    <Text style={{ color: p.text, fontSize: 16, fontWeight: '800', marginTop: 3 }}>
                      {fmtDateLong(r.period_start)} – {fmtDateLong(r.period_end)}
                    </Text>
                  </View>
                  <StatusBadge label={r.is_locked ? t('royalties.locked') : t('royalties.open')} tone={r.is_locked ? 'good' : 'neutral'} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
                  <View style={{ minWidth: 120 }}>
                    <Text style={{ color: p.text3, fontSize: 11 }}>{t('royalties.gross')}</Text>
                    <Money style={{ fontSize: 16, fontWeight: '800' }}>{fmtMoney(r.total_gross, cur)}</Money>
                  </View>
                  <View style={{ minWidth: 120 }}>
                    <Text style={{ color: p.text3, fontSize: 11 }}>{t('royalties.payable')}</Text>
                    <Money style={{ fontSize: 16, fontWeight: '800', color: p.accent }}>{fmtMoney(r.total_net_payable, cur)}</Money>
                  </View>
                  <View style={{ minWidth: 120 }}>
                    <Text style={{ color: p.text3, fontSize: 11 }}>{t('artists.recouped')}</Text>
                    <Money style={{ fontSize: 16, fontWeight: '800' }}>{fmtMoney(r.total_recouped, cur)}</Money>
                  </View>
                </View>
              </Card>

              <Card>
                <SectionTitle>{artists.length} {t('royalties.artists')}</SectionTitle>
                <View style={{ marginTop: 4 }}>
                  {artists.map((a, i) => (
                    <View key={a.artist_id}>
                      {i > 0 ? <Divider /> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{a.artist_name}</Text>
                          <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>
                            {fmtNum(a.transaction_count)} {t('royalties.transactions')}
                            {a.paid_at ? '  ·  payé' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Money style={{ fontSize: 14, fontWeight: '800', color: parseFloat(a.net_payable) > 0 ? p.accent : p.text2 }}>
                            {fmtMoney(a.net_payable, cur)}
                          </Money>
                          <Text style={{ color: p.text3, fontSize: 11 }}>brut {fmtMoney(a.gross, cur)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
