import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Cover } from '@/components/ui';
import { State, StatusBadge } from '@/components/kit';
import { IconSpotify, IconCheck } from '@/components/icons';
import { useFetch, clearFetchCache } from '@/lib/useFetch';
import { getSpotifySuggestions, approveSuggestion, rejectSuggestion, SpotifySuggestion } from '@/lib/api';
import { fmtDateLong } from '@/lib/format';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';
const FILTERS: Filter[] = ['pending', 'approved', 'rejected', 'all'];

export default function SpotifySuggestionsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>('pending');
  const { data, loading, error, reload } = useFetch(() => getSpotifySuggestions(filter), [filter], `spotify-sug:${filter}`);
  const [acting, setActing] = useState<string | null>(null);

  React.useEffect(() => { nav.setOptions?.({ title: t('spotify.title') }); }, [nav, t]);

  const items = data || [];

  const act = async (id: string, kind: 'approve' | 'reject') => {
    setActing(id);
    try {
      if (kind === 'approve') await approveSuggestion(id);
      else await rejectSuggestion(id);
      clearFetchCache('spotify-sug');
      reload();
    } catch {
      // ignore; list will reflect server state on next load
    } finally {
      setActing(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 18, paddingBottom: 8 }}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: filter === f ? p.accent : p.surface2, borderColor: filter === f ? p.accent : p.border, borderWidth: 1 }}>
            <Text style={{ color: filter === f ? p.accentInk : p.text2, fontSize: 12, fontWeight: '700' }}>{t(`spotify.${f}`)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 36, gap: 12 }}>
        <State loading={loading} error={error} onRetry={reload} empty={!!data && items.length === 0}>
          {items.map((s: SpotifySuggestion) => (
            <Card key={s.id}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Cover size={52} uri={s.image_url} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconSpotify size={15} />
                    <Text style={{ color: p.text, fontSize: 14, fontWeight: '800', flex: 1 }} numberOfLines={1}>{s.track_name}</Text>
                  </View>
                  <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                    {[s.artist_name, s.album_name, s.album_type].filter(Boolean).join('  ·  ')}
                  </Text>
                  <Text style={{ color: p.text3, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                    {[s.label_name, s.release_date ? fmtDateLong(s.release_date) : null, s.isrc].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              </View>

              {s.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => act(s.id, 'approve')} disabled={acting === s.id}
                    style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: p.accent, borderRadius: 10, paddingVertical: 10, opacity: acting === s.id ? 0.5 : pressed ? 0.85 : 1 })}
                  >
                    {acting === s.id ? <ActivityIndicator color={p.accentInk} /> : <IconCheck size={16} color={p.accentInk} />}
                    <Text style={{ color: p.accentInk, fontWeight: '800', fontSize: 13 }}>{t('spotify.approve')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => act(s.id, 'reject')} disabled={acting === s.id}
                    style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(220,76,87,0.1)', borderRadius: 10, paddingVertical: 10, opacity: acting === s.id ? 0.5 : pressed ? 0.85 : 1 })}
                  >
                    <Text style={{ color: p.neg, fontWeight: '800', fontSize: 13 }}>{t('spotify.reject')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <StatusBadge label={t(`spotify.${s.status}`)} tone={s.status === 'approved' ? 'good' : 'bad'} />
                  {s.spotify_url ? (
                    <Pressable onPress={() => Linking.openURL(s.spotify_url!).catch(() => {})}>
                      <Text style={{ color: p.accent, fontSize: 12.5, fontWeight: '700' }}>Spotify ↗</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </Card>
          ))}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
