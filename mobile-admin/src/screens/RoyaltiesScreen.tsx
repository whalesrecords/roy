import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money } from '@/components/ui';
import { Screen, State, StatusBadge } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getRoyaltyRuns, RoyaltyRun } from '@/lib/api';
import { fmtMoney, fmtNum, fmtDateShort } from '@/lib/format';

export default function RoyaltiesScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useFetch(() => getRoyaltyRuns(50, 0), [], 'runs');

  const runs = data || [];

  const RunCard = ({ r }: { r: RoyaltyRun }) => (
    <Pressable onPress={() => nav.navigate('RunDetail', { id: r.run_id })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{t('royalties.period')}</Eyebrow>
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '800', marginTop: 3 }}>
              {fmtDateShort(r.period_start)} – {fmtDateShort(r.period_end)}
            </Text>
          </View>
          <StatusBadge
            label={r.is_locked ? t('royalties.locked') : t('royalties.open')}
            tone={r.is_locked ? 'good' : 'neutral'}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={{ color: p.text3, fontSize: 11 }}>{t('royalties.payable')}</Text>
            <Money style={{ fontSize: 18, fontWeight: '800', color: p.accent }}>{fmtMoney(r.total_net_payable, r.base_currency)}</Money>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: p.text3, fontSize: 11.5 }}>{r.artists.length} {t('royalties.artists')}</Text>
            <Text style={{ color: p.text3, fontSize: 11.5 }}>{fmtNum(r.total_transactions)} {t('royalties.transactions')}</Text>
          </View>
          <IconChevronRight size={18} color={p.text3} />
        </View>
      </Card>
    </Pressable>
  );

  return (
    <Screen title={t('royalties.title')} onRefresh={reload} refreshing={loading}>
      <State loading={loading} error={error} onRetry={reload} empty={!!data && runs.length === 0}>
        {runs.map((r) => <RunCard key={r.run_id} r={r} />)}
      </State>
    </Screen>
  );
}
