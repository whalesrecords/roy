import React from 'react';
import { View, Text, Pressable, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money, Avatar, Loader } from '@/components/ui';
import { State, SectionTitle, Divider, StatusBadge } from '@/components/kit';
import { IconChevronRight, IconLink } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getArtist, getAdvanceBalance } from '@/lib/api';
import { fmtMoney, fmtDateLong } from '@/lib/format';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'neg' }) {
  const p = usePalette();
  const color = tone === 'accent' ? p.accent : tone === 'neg' ? p.neg : p.text;
  return (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 18, fontWeight: '800', marginTop: 4, color }}>{value}</Money>
    </View>
  );
}

export default function ArtistDetailScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, name } = route.params || {};

  const artistQ = useFetch(() => getArtist(id), [id]);
  const balanceQ = useFetch(() => getAdvanceBalance(id), [id]);
  const a = artistQ.data;
  const bal = balanceQ.data;

  React.useEffect(() => { nav.setOptions?.({ title: name || 'Artiste' }); }, [nav, name]);

  const socials: { label: string; url?: string | null }[] = [
    { label: 'Instagram', url: a?.instagram_url },
    { label: 'TikTok', url: a?.tiktok_url },
    { label: 'YouTube', url: a?.youtube_url },
    { label: 'Twitter / X', url: a?.twitter_url },
    { label: 'Facebook', url: a?.facebook_url },
  ].filter((s) => !!s.url);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={artistQ.loading} error={artistQ.error} onRetry={artistQ.reload}>
          {a ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Avatar name={a.name} uri={a.image_url} size={64} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>{a.name}</Text>
                  {a.category ? <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 2 }}>{a.category}</Text> : null}
                  {a.email ? <Text style={{ color: p.text2, fontSize: 12.5, marginTop: 2 }}>{a.email}</Text> : null}
                </View>
              </View>

              <Card>
                <SectionTitle>{t('artists.balance')}</SectionTitle>
                {balanceQ.loading ? <View style={{ height: 60 }}><Loader /></View> : bal ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
                      <Stat
                        label={t('artists.balance')}
                        value={fmtMoney(bal.balance, bal.currency)}
                        tone={parseFloat(bal.balance) > 0 ? 'neg' : 'accent'}
                      />
                      <Stat label={t('artists.advances')} value={fmtMoney(bal.total_advances, bal.currency)} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
                      <Stat label={t('artists.recouped')} value={fmtMoney(bal.total_recouped, bal.currency)} />
                      <Stat label={t('artists.payments')} value={fmtMoney(bal.total_payments, bal.currency)} />
                    </View>
                  </>
                ) : (
                  <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 8 }}>—</Text>
                )}
              </Card>

              {socials.length ? (
                <Card>
                  <SectionTitle>{t('artists.social')}</SectionTitle>
                  <View style={{ marginTop: 4 }}>
                    {socials.map((s, i) => (
                      <View key={s.label}>
                        {i > 0 ? <Divider /> : null}
                        <Pressable
                          onPress={() => s.url && Linking.openURL(s.url).catch(() => {})}
                          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
                        >
                          <IconLink size={16} color={p.accent} />
                          <Text style={{ color: p.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{s.label}</Text>
                          <IconChevronRight size={16} color={p.text3} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Eyebrow>Référence</Eyebrow>
                  {a.access_code ? <StatusBadge label="Code artiste" tone="good" /> : null}
                </View>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {a.spotify_id ? <Text style={{ color: p.text2, fontSize: 12.5 }}>Spotify · {a.spotify_id}</Text> : null}
                  {a.external_id ? <Text style={{ color: p.text2, fontSize: 12.5 }}>ID externe · {a.external_id}</Text> : null}
                  <Text style={{ color: p.text3, fontSize: 12 }}>Créé le {fmtDateLong(a.created_at)}</Text>
                </View>
              </Card>
            </>
          ) : null}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
