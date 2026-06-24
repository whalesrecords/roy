import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getArtistReleases, getArtistTracks, invalidateCache, ArtistRelease, ArtistTrack,
} from '@/lib/api';
import { Card, Eyebrow, Money, Cover, Loader } from '@/components/ui';
import { fmtMoney, fmtNum } from '@/lib/format';

type Tab = 'titres' | 'sorties';

export default function MusicScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [releases, setReleases] = useState<ArtistRelease[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [tab, setTab] = useState<Tab>('titres');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, tr] = await Promise.all([getArtistReleases(), getArtistTracks()]);
    setReleases(r);
    setTracks(tr);
  }, []);

  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateCache('/artist-portal');
    try { await load(); } finally { setRefreshing(false); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('nav.music')}</Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: 12, padding: 4, borderColor: p.border, borderWidth: 1 }}>
          {(['titres', 'sorties'] as Tab[]).map((m) => (
            <Pressable key={m} onPress={() => setTab(m)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: tab === m ? p.surface : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: tab === m ? p.text : p.text3, fontWeight: '600', fontSize: 13 }}>
                {m === 'titres' ? 'Titres' : 'Sorties'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'sorties' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {releases.length === 0 ? (
              <Text style={{ color: p.text3, fontSize: 13, paddingVertical: 28 }}>Aucune sortie</Text>
            ) : releases.map((r) => (
              <View key={r.upc} style={{ width: '48%', marginBottom: 16 }}>
                <Cover size={170} radius={14} uri={r.artwork_url} />
                <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '600', marginTop: 10 }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{r.track_count} titre{r.track_count > 1 ? 's' : ''} · {fmtNum(r.streams)}</Text>
                <Money style={{ fontSize: 13, fontWeight: '700', marginTop: 4 }}>{fmtMoney(r.net, r.currency)}</Money>
              </View>
            ))}
          </View>
        ) : (
          <Card style={{ padding: 0 }}>
            {tracks.length === 0 ? (
              <Text style={{ color: p.text3, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>{t('common.noTrack')}</Text>
            ) : tracks.map((tr, i) => (
              <View key={tr.isrc || tr.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11, borderBottomColor: p.border, borderBottomWidth: i < tracks.length - 1 ? 1 : 0 }}>
                <Cover size={44} radius={10} uri={tr.artwork_url} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{tr.title}</Text>
                  <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{(tr.release_title || 'Single')} · {fmtNum(tr.streams)}</Text>
                </View>
                <Money style={{ fontSize: 13, fontWeight: '700' }}>{fmtMoney(tr.gross, tr.currency)}</Money>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
