import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card } from '@/components/ui';
import { State, Divider, StatusBadge } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getImports, ImportItem } from '@/lib/api';
import { fmtNum, fmtDateShort, fmtDateLong } from '@/lib/format';

function tone(status: string): 'good' | 'warn' | 'bad' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('complet') || s === 'success' || s === 'done') return 'good';
  if (s.includes('fail') || s.includes('error') || s.includes('échou')) return 'bad';
  if (s.includes('pending') || s.includes('process') || s.includes('cours')) return 'warn';
  return 'neutral';
}

export default function ImportsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useFetch(() => getImports(50), [], 'imports-list');

  React.useEffect(() => { nav.setOptions?.({ title: t('imports.title') }); }, [nav, t]);

  const imports = data || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={loading} error={error} onRetry={reload} empty={!!data && imports.length === 0}>
          <Card>
            {imports.map((im: ImportItem, i) => (
              <View key={im.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ color: p.text, fontSize: 14, fontWeight: '700', flex: 1, textTransform: 'capitalize' }} numberOfLines={1}>
                      {im.source || im.filename || '—'}
                    </Text>
                    <StatusBadge label={im.status} tone={tone(im.status)} />
                  </View>
                  <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 4 }}>
                    {t('imports.period')} : {fmtDateShort(im.period_start)} – {fmtDateShort(im.period_end)}
                  </Text>
                  <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>
                    {fmtNum(im.success_rows)}/{fmtNum(im.total_rows)} lignes
                    {im.error_rows > 0 ? ` · ${fmtNum(im.error_rows)} erreurs` : ''} · {fmtDateLong(im.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
          <Text style={{ color: p.text3, fontSize: 11.5, textAlign: 'center' }}>{t('imports.hint')}</Text>
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
