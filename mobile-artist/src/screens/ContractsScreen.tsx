import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Loader } from '@/components/ui';
import { IconChevronRight, IconCheck } from '@/components/icons';
import { getContracts, Contract } from '@/lib/api';
import { fmtDateShort } from '@/lib/format';

const SCOPE_LABEL: Record<string, string> = { catalog: 'Catalogue', release: 'Release', track: 'Titre' };

export default function ContractsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getContracts().then(setContracts).catch(() => setContracts([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  // Refresh signed status when returning from the signing screen.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = contracts || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={p.accent} />}
      >
        {loading && !contracts ? <Loader /> : null}
        {contracts && list.length === 0 ? (
          <Card><Text style={{ color: p.text3, fontSize: 13.5, textAlign: 'center' }}>{t('contracts.empty')}</Text></Card>
        ) : null}
        {list.map((c) => {
          const title = c.scope_title || SCOPE_LABEL[c.scope] || c.scope;
          return (
            <Pressable key={c.id} onPress={() => nav.navigate('ContractSign', { contract: c })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{title}</Text>
                    <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 3 }}>
                      {SCOPE_LABEL[c.scope] || c.scope}
                      {`  ·  ${fmtDateShort(c.start_date)} – ${c.end_date ? fmtDateShort(c.end_date) : t('contracts.noEnd')}`}
                    </Text>
                    <Text style={{ color: p.text2, fontSize: 12.5, marginTop: 4 }}>
                      {t('contracts.artistShare')} : <Text style={{ fontWeight: '800', color: p.text }}>{Math.round((c.artist_share || 0) * 100)} %</Text>
                    </Text>
                  </View>
                  {c.signed ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: p.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <IconCheck size={13} color={p.accent} />
                      <Text style={{ color: p.accent, fontSize: 11, fontWeight: '800' }}>{t('contracts.signed')}</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: 'rgba(227,179,65,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: '#C9982B', fontSize: 11, fontWeight: '800' }}>{t('contracts.toSign')}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                  <IconChevronRight size={16} color={p.text3} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
