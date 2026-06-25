import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow } from '@/components/ui';
import { State, StatusBadge } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { useFetch, useRefreshOnFocus } from '@/lib/useFetch';
import { getContracts, getArtistsSummary, ContractListItem, ContractParty } from '@/lib/api';
import { fmtShare, fmtDateShort } from '@/lib/format';

const PARTY_LABELS_FR: Record<string, string> = {
  artist: 'Artiste', label: 'Label', manager: 'Manager', booker: 'Booker',
  agent: 'Agent', publisher: 'Éditeur', other: 'Autre',
};

function scopeTone(scope: string): 'good' | 'warn' | 'neutral' {
  if (scope === 'catalog') return 'good';
  if (scope === 'release') return 'warn';
  return 'neutral';
}

function partyName(pty: ContractParty, names: Record<string, string>): string {
  if (pty.party_type === 'artist') return pty.artist_id ? (names[pty.artist_id] || 'Artiste') : 'Artiste';
  return pty.label_name || PARTY_LABELS_FR[pty.party_type] || pty.party_type;
}

export default function ContractsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { artistId, artistName } = route.params || {};

  const cacheKey = `contracts:${artistId || 'all'}`;
  const { data, loading, error, reload } = useFetch(() => getContracts(artistId), [artistId], cacheKey);
  const namesQ = useFetch(getArtistsSummary, [], 'artists');
  const names: Record<string, string> = {};
  (namesQ.data || []).forEach((a) => { names[a.id] = a.name; });
  useRefreshOnFocus(cacheKey, reload);

  React.useEffect(() => {
    nav.setOptions?.({
      title: artistName ? `${t('contracts.title')} · ${artistName}` : t('contracts.title'),
      headerRight: () => (
        <Pressable
          onPress={() => nav.navigate('ContractForm', artistId ? { artistId, artistName } : {})}
          hitSlop={10}
        >
          <Text style={{ color: p.accent, fontSize: 26, fontWeight: '600', marginRight: 4 }}>＋</Text>
        </Pressable>
      ),
    });
  }, [nav, t, artistName, artistId, p.accent]);

  const contracts = data ? [...data].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '')) : [];

  const ContractCard = ({ c }: { c: ContractListItem }) => {
    const scopeLabel = t(`contracts.scope.${c.scope}`);
    const title = artistName || names[c.artist_id] || scopeLabel;
    return (
      <Pressable onPress={() => nav.navigate('ContractDetail', { id: c.id, title })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
              <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 3 }}>
                {scopeLabel}{c.scope_id ? ` · ${c.scope_id}` : ''}
              </Text>
            </View>
            <StatusBadge label={scopeLabel} tone={scopeTone(c.scope)} />
          </View>

          <View style={{ marginTop: 10 }}>
            {c.parties.map((pty, i) => (
              <View key={pty.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                <Text style={{ color: p.text2, fontSize: 12.5 }} numberOfLines={1}>{partyName(pty, names)}</Text>
                <Text style={{ color: p.text, fontSize: 12.5, fontWeight: '700' }}>{fmtShare(pty.share_percentage)}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: p.text3, fontSize: 11.5 }}>
              {fmtDateShort(c.start_date)} – {c.end_date ? fmtDateShort(c.end_date) : t('contracts.noEnd')}
            </Text>
            <IconChevronRight size={16} color={p.text3} />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        {data ? <Eyebrow>{contracts.length} {t('contracts.title').toLowerCase()}</Eyebrow> : null}
        <State loading={loading} error={error} onRetry={reload} empty={!!data && contracts.length === 0}>
          {contracts.map((c) => <ContractCard key={c.id} c={c} />)}
        </State>
      </ScrollView>
    </SafeAreaView>
  );
}
