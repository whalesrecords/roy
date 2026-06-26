import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Money } from '@/components/ui';
import { State, Divider, StatusBadge } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getCatalogArtistReleases, getCatalogArtistTracks } from '@/lib/api';
import { fmtMoney, fmtNum } from '@/lib/format';

type Tab = 'releases' | 'tracks';

export default function CatalogArtistScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { name } = route.params || {};
  const [tab, setTab] = useState<Tab>('releases');

  const relQ = useFetch(() => getCatalogArtistReleases(name), [name], `cat-rel:${name}`);
  const trkQ = useFetch(() => getCatalogArtistTracks(name), [name], `cat-trk:${name}`);

  React.useEffect(() => { nav.setOptions?.({ title: name || t('catalog.title') }); }, [nav, name, t]);

  const releases = relQ.data ? [...relQ.data].sort((a, b) => parseFloat(b.total_gross) - parseFloat(a.total_gross)) : [];
  const tracks = trkQ.data ? [...trkQ.data].sort((a, b) => parseFloat(b.total_gross) - parseFloat(a.total_gross)) : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: 12, padding: 4, margin: 18, marginBottom: 6, borderColor: p.border, borderWidth: 1 }}>
        {(['releases', 'tracks'] as Tab[]).map((tb) => (
          <Pressable key={tb} onPress={() => setTab(tb)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: tab === tb ? p.surface : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: tab === tb ? p.text : p.text3, fontWeight: '700', fontSize: 13 }}>
              {tb === 'releases' ? t('catalog.releases') : t('catalog.tracks')}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 8, paddingBottom: 36, gap: 14 }}>
        {tab === 'releases' ? (
          <State loading={relQ.loading} error={relQ.error} onRetry={relQ.reload} empty={!!relQ.data && releases.length === 0}>
            {releases.map((r) => (
              <Pressable
                key={r.upc}
                onPress={() => r.upc && r.upc !== 'UNKNOWN' && nav.navigate('ReleaseTracks', { upc: r.upc, title: r.release_title })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={2}>{r.release_title}</Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 3 }}>
                        {fmtNum(r.track_count)} titres · {fmtNum(r.total_streams)} streams
                        {r.upc && r.upc !== 'UNKNOWN' ? ` · ${r.upc}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Money style={{ fontSize: 14, fontWeight: '800', color: p.accent }}>{fmtMoney(r.total_gross, r.currency)}</Money>
                    </View>
                    {r.upc && r.upc !== 'UNKNOWN' ? <IconChevronRight size={16} color={p.text3} /> : null}
                  </View>
                </Card>
              </Pressable>
            ))}
          </State>
        ) : (
          <State loading={trkQ.loading} error={trkQ.error} onRetry={trkQ.reload} empty={!!trkQ.data && tracks.length === 0}>
            <Card>
              {tracks.map((tk, i) => (
                <View key={tk.isrc || i}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{tk.track_title}</Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>
                        {tk.release_title || tk.isrc}{tk.is_collaboration ? ` · collab. ${tk.share_percent ?? ''}` : ''}
                      </Text>
                    </View>
                    {tk.is_collaboration ? <StatusBadge label="Collab" tone="warn" /> : null}
                    <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent }}>{fmtMoney(tk.total_gross, tk.currency)}</Money>
                  </View>
                </View>
              ))}
            </Card>
          </State>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
