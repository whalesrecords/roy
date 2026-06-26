import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { Card, Money } from '@/components/ui';
import { State, Divider } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getReleaseTracks } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

export default function ReleaseTracksScreen() {
  const p = usePalette();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { upc, title } = route.params || {};
  const { data, loading, error, reload } = useFetch(() => getReleaseTracks(upc), [upc], `rel-trk:${upc}`);

  React.useEffect(() => { nav.setOptions?.({ title: title || upc }); }, [nav, title, upc]);

  const tracks = data || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={loading} error={error} onRetry={reload} empty={!!data && tracks.length === 0}>
          <Card>
            {tracks.map((tk, i) => (
              <View key={tk.isrc || i}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 }}>
                  <Text style={{ color: p.text3, fontSize: 12, width: 22 }}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{tk.track_title}</Text>
                    <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                      {tk.artist_name}{tk.isrc ? ` · ${tk.isrc}` : ''} · {fmtNum(tk.total_streams)} streams
                    </Text>
                  </View>
                  <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent }}>{fmtMoney(tk.total_gross)}</Money>
                </View>
              </View>
            ))}
          </Card>
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
