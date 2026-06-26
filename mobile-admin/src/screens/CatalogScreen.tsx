import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Money } from '@/components/ui';
import { State } from '@/components/kit';
import { IconSearch, IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getCatalogArtists, CatalogArtist } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

export default function CatalogScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useFetch(getCatalogArtists, [], 'catalog-artists');
  const [q, setQ] = useState('');

  React.useEffect(() => { nav.setOptions?.({ title: t('catalog.title') }); }, [nav, t]);

  const list = useMemo(() => {
    const arr = [...(data || [])].sort((a, b) => parseFloat(b.total_gross) - parseFloat(a.total_gross));
    if (!q.trim()) return arr;
    const n = q.trim().toLowerCase();
    return arr.filter((a) => a.artist_name.toLowerCase().includes(n));
  }, [data, q]);

  const renderItem = ({ item }: { item: CatalogArtist }) => (
    <Pressable
      onPress={() => nav.navigate('CatalogArtist', { name: item.artist_name })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 14, marginBottom: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{item.artist_name}</Text>
        <Text style={{ color: p.text3, fontSize: 12, marginTop: 2 }}>
          {fmtNum(item.release_count)} releases · {fmtNum(item.track_count)} titres · {fmtNum(item.total_streams)} streams
        </Text>
      </View>
      <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent }}>{fmtMoney(item.total_gross, item.currency)}</Money>
      <IconChevronRight size={18} color={p.text3} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
          <IconSearch size={18} color={p.text3} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('catalog.search')} placeholderTextColor={p.text3} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: p.text, fontSize: 15, paddingVertical: 11 }} />
        </View>
        {data ? <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 8 }}>{list.length} {t('artists.count')}</Text> : null}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 18 }}>
        <State loading={loading} error={error} onRetry={reload} empty={!!data && list.length === 0}>
          <FlatList data={list} keyExtractor={(a) => a.artist_name} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" />
        </State>
      </View>
    </SafeAreaView>
  );
}
