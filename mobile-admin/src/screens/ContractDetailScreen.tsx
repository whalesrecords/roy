import React from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow } from '@/components/ui';
import { State, SectionTitle, StatusBadge, Divider } from '@/components/kit';
import { IconLink, IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getContract, getArtistsSummary, ContractParty } from '@/lib/api';
import { fmtShare, fmtDateLong } from '@/lib/format';

const PARTY_LABELS_FR: Record<string, string> = {
  artist: 'Artiste', label: 'Label', manager: 'Manager', booker: 'Booker',
  agent: 'Agent', publisher: 'Éditeur', other: 'Autre',
};

export default function ContractDetailScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, title } = route.params || {};
  const { data: c, loading, error, reload } = useFetch(() => getContract(id), [id]);
  const namesQ = useFetch(getArtistsSummary);
  const names: Record<string, string> = {};
  (namesQ.data || []).forEach((a) => { names[a.id] = a.name; });

  React.useEffect(() => { nav.setOptions?.({ title: title || t('contracts.title') }); }, [nav, t, title]);

  const partyName = (pty: ContractParty) =>
    pty.party_type === 'artist'
      ? (pty.artist_id ? names[pty.artist_id] || 'Artiste' : 'Artiste')
      : pty.label_name || PARTY_LABELS_FR[pty.party_type] || pty.party_type;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <State loading={loading} error={error} onRetry={reload}>
          {c ? (
            <>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Eyebrow>{t('contracts.period')}</Eyebrow>
                  <StatusBadge label={t(`contracts.scope.${c.scope}`)} tone={c.scope === 'catalog' ? 'good' : c.scope === 'release' ? 'warn' : 'neutral'} />
                </View>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 6 }}>
                  {fmtDateLong(c.start_date)} – {c.end_date ? fmtDateLong(c.end_date) : t('contracts.noEnd')}
                </Text>
                {c.scope_id ? <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 4 }}>{c.scope_id}</Text> : null}
                {c.description ? <Text style={{ color: p.text2, fontSize: 13, marginTop: 8, lineHeight: 18 }}>{c.description}</Text> : null}
                {c.document_url ? (
                  <Pressable
                    onPress={() => c.document_url && Linking.openURL(c.document_url).catch(() => {})}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, opacity: pressed ? 0.6 : 1 })}
                  >
                    <IconLink size={16} color={p.accent} />
                    <Text style={{ color: p.accent, fontSize: 13.5, fontWeight: '700', flex: 1 }}>{t('contracts.document')}</Text>
                    <IconChevronRight size={16} color={p.text3} />
                  </Pressable>
                ) : null}
              </Card>

              <Card>
                <SectionTitle>{t('contracts.parties')}</SectionTitle>
                <View style={{ marginTop: 4 }}>
                  {c.parties.map((pty, i) => (
                    <View key={pty.id || i}>
                      {i > 0 ? <Divider /> : null}
                      <View style={{ paddingVertical: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{partyName(pty)}</Text>
                            <Text style={{ color: p.text3, fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>
                              {PARTY_LABELS_FR[pty.party_type] || pty.party_type}
                            </Text>
                          </View>
                          <Text style={{ color: p.accent, fontSize: 16, fontWeight: '800' }}>{fmtShare(pty.share_percentage)}</Text>
                        </View>
                        {(pty.share_physical != null || pty.share_digital != null) ? (
                          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                            {pty.share_physical != null ? (
                              <Text style={{ color: p.text3, fontSize: 11.5 }}>{t('contracts.physical')} {fmtShare(pty.share_physical)}</Text>
                            ) : null}
                            {pty.share_digital != null ? (
                              <Text style={{ color: p.text3, fontSize: 11.5 }}>{t('contracts.digital')} {fmtShare(pty.share_digital)}</Text>
                            ) : null}
                          </View>
                        ) : null}
                        {(pty.contact_email || pty.contact_phone) ? (
                          <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 4 }}>
                            {[pty.contact_email, pty.contact_phone].filter(Boolean).join('  ·  ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          ) : null}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
