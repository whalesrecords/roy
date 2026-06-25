import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Avatar, Money } from '@/components/ui';
import { Screen, State } from '@/components/kit';
import { IconSearch, IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getArtistsSummary, ArtistSummary } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

export default function ArtistsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const { data, loading, error, reload } = useFetch(getArtistsSummary, [], 'artists');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const arr = data || [];
    const sorted = [...arr].sort((a, b) => parseFloat(b.total_gross) - parseFloat(a.total_gross));
    if (!q.trim()) return sorted;
    const needle = q.trim().toLowerCase();
    return sorted.filter((a) => a.name.toLowerCase().includes(needle));
  }, [data, q]);

  const renderItem = ({ item }: { item: ArtistSummary }) => (
    <Pressable
      onPress={() => nav.navigate('ArtistDetail', { id: item.id, name: item.name })}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
        backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 14, marginBottom: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Avatar name={item.name} uri={item.image_url_small || item.image_url} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ color: p.text3, fontSize: 12, marginTop: 2 }}>
          {fmtNum(item.total_streams)} {t('artists.streams')}
          {item.has_collaborations ? '  ·  collab.' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent }}>{fmtMoney(item.total_gross)}</Money>
      </View>
      <IconChevronRight size={18} color={p.text3} />
    </Pressable>
  );

  return (
    <Screen title={t('artists.title')} scroll={false}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
          <IconSearch size={18} color={p.text3} />
          <TextInput
            value={q} onChangeText={setQ} placeholder={t('artists.search')} placeholderTextColor={p.text3}
            autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, color: p.text, fontSize: 15, paddingVertical: 11 }}
          />
        </View>
        {data ? <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 8 }}>{list.length} {t('artists.count')}</Text> : null}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 18 }}>
        <State loading={loading} error={error} onRetry={reload} empty={!!data && list.length === 0}>
          <FlatList
            data={list}
            keyExtractor={(a) => a.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          />
        </State>
      </View>
    </Screen>
  );
}
