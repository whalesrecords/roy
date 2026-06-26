import React from 'react';
import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow } from '@/components/ui';
import { State, SectionTitle, StatusBadge, Divider } from '@/components/kit';
import { IconLink, IconChevronRight, IconLogout, IconFile } from '@/components/icons';
import { useFetch, useRefreshOnFocus } from '@/lib/useFetch';
import { getContract, getArtistsSummary, deleteContract, ContractParty } from '@/lib/api';
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
  const { data: c, loading, error, reload } = useFetch(() => getContract(id), [id], `contract:${id}`);
  const namesQ = useFetch(getArtistsSummary, [], 'artists');
  const names: Record<string, string> = {};
  (namesQ.data || []).forEach((a) => { names[a.id] = a.name; });
  useRefreshOnFocus(`contract:${id}`, reload);

  const confirmDelete = () => {
    Alert.alert('Supprimer le contrat', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try { await deleteContract(id); nav.goBack(); }
          catch (e: any) { Alert.alert('Erreur', e?.message || 'Suppression impossible'); }
        },
      },
    ]);
  };

  React.useEffect(() => {
    nav.setOptions?.({
      title: title || t('contracts.title'),
      headerRight: () => c ? (
        <Pressable onPress={() => nav.navigate('ContractForm', { id, prefill: c, artistName: title })} hitSlop={10}>
          <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700', marginRight: 4 }}>{t('common.edit')}</Text>
        </Pressable>
      ) : null,
    });
  }, [nav, t, title, c, id, p.accent]);

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
                {c.scope_title ? (
                  <Text style={{ color: p.text, fontSize: 17, fontWeight: '800', marginTop: 6 }}>{c.scope_title}</Text>
                ) : null}
                <Text style={{ color: c.scope_title ? p.text3 : p.text, fontSize: c.scope_title ? 12.5 : 15, fontWeight: c.scope_title ? '400' : '700', marginTop: c.scope_title ? 2 : 6 }}>
                  {fmtDateLong(c.start_date)} – {c.end_date ? fmtDateLong(c.end_date) : t('contracts.noEnd')}
                </Text>
                {c.scope_id ? <Text style={{ color: p.text3, fontSize: 12, marginTop: 3 }}>{c.scope_id}</Text> : null}
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

              <Pressable onPress={() => nav.navigate('ContractContributors', { id, scope: c.scope, scopeId: c.scope_id, scopeTitle: c.scope_title })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <IconFile size={18} color={p.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }}>{t('contributors.title')}</Text>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 1 }}>{t('contributors.subtitle')}</Text>
                    </View>
                    <IconChevronRight size={18} color={p.text3} />
                  </View>
                </Card>
              </Pressable>

              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, paddingVertical: 13, backgroundColor: 'rgba(220,76,87,0.1)', borderRadius: 12, opacity: pressed ? 0.7 : 1 })}
              >
                <IconLogout size={17} color={p.neg} />
                <Text style={{ color: p.neg, fontWeight: '700', fontSize: 14 }}>{t('common.delete')}</Text>
              </Pressable>
            </>
          ) : null}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
