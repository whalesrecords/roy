import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, AccentButton } from '@/components/ui';
import { SectionTitle, Divider } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { ArtistPicker } from '@/components/ArtistPicker';
import { useFetch } from '@/lib/useFetch';
import {
  createContract, updateContract, getArtistsSummary,
  ContractDetail, ContractPartyInput,
} from '@/lib/api';

type Scope = 'catalog' | 'release' | 'track';
const SCOPES: Scope[] = ['catalog', 'release', 'track'];
const PARTY_TYPES = ['artist', 'label', 'manager', 'booker', 'agent', 'publisher', 'other'];
const PARTY_LABELS: Record<string, string> = {
  artist: 'Artiste', label: 'Label', manager: 'Manager', booker: 'Booker',
  agent: 'Agent', publisher: 'Éditeur', other: 'Autre',
};

interface PartyForm {
  party_type: string;
  artist: { id: string; name: string } | null;
  label_name: string;
  share: string;
  sharePhysical: string;
  shareDigital: string;
  contact_email: string;
  contact_phone: string;
  advanced: boolean;
}

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v ?? 0;
  return isFinite(n as number) ? (n as number) : 0;
};
const pctStr = (v: string | number | null | undefined): string => {
  const n = num(v) * 100;
  return n ? String(Math.round(n * 100) / 100) : '';
};

function emptyParty(type = 'artist'): PartyForm {
  return { party_type: type, artist: null, label_name: '', share: '', sharePhysical: '', shareDigital: '', contact_email: '', contact_phone: '', advanced: false };
}

export default function ContractFormScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, prefill, artistId, artistName } = route.params || {};
  const isEdit = !!id;
  const c: ContractDetail | undefined = prefill;

  const namesQ = useFetch(getArtistsSummary, [], 'artists');
  const names: Record<string, string> = {};
  (namesQ.data || []).forEach((a) => { names[a.id] = a.name; });

  const [artist, setArtist] = useState<{ id: string; name: string } | null>(
    c ? { id: c.artist_id, name: artistName || '' } : artistId ? { id: artistId, name: artistName || '' } : null,
  );
  const [scope, setScope] = useState<Scope>((c?.scope as Scope) || 'catalog');
  const [scopeId, setScopeId] = useState(c?.scope_id || '');
  const [startDate, setStartDate] = useState(c?.start_date || '');
  const [endDate, setEndDate] = useState(c?.end_date || '');
  const [description, setDescription] = useState(c?.description || '');
  const [parties, setParties] = useState<PartyForm[]>(
    c && c.parties.length
      ? c.parties.map((pt) => ({
          party_type: pt.party_type,
          artist: pt.party_type === 'artist' && pt.artist_id ? { id: pt.artist_id, name: '' } : null,
          label_name: pt.label_name || '',
          share: pctStr(pt.share_percentage),
          sharePhysical: pctStr(pt.share_physical),
          shareDigital: pctStr(pt.share_digital),
          contact_email: pt.contact_email || '',
          contact_phone: pt.contact_phone || '',
          advanced: pt.share_physical != null || pt.share_digital != null,
        }))
      : [{ ...emptyParty('artist'), share: '100' }],
  );
  const [pickerFor, setPickerFor] = useState<number | 'primary' | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    nav.setOptions?.({ title: isEdit ? t('cform.editTitle') : t('cform.newTitle') });
  }, [nav, t, isEdit]);

  const total = parties.reduce((s, pt) => s + num(pt.share), 0);
  const totalOk = Math.abs(total - 100) < 0.5;

  const setParty = (i: number, patch: Partial<PartyForm>) =>
    setParties((arr) => arr.map((pt, idx) => (idx === i ? { ...pt, ...patch } : pt)));
  const addParty = () => setParties((arr) => [...arr, emptyParty('label')]);
  const removeParty = (i: number) => setParties((arr) => arr.filter((_, idx) => idx !== i));

  const label = (a: { id: string; name: string } | null) =>
    a ? (a.name || names[a.id] || 'Artiste') : t('cform.choose');

  const submit = async () => {
    if (!isEdit && !artist) { Alert.alert('', t('cform.needArtist')); return; }
    if (scope !== 'catalog' && !scopeId.trim()) { Alert.alert('', t('cform.needScopeId')); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) { Alert.alert('', t('cform.needDate')); return; }
    if (!totalOk) { Alert.alert('', t('cform.mustSum')); return; }

    const partyPayload: ContractPartyInput[] = parties.map((pt) => ({
      party_type: pt.party_type,
      artist_id: pt.party_type === 'artist' ? pt.artist?.id ?? null : null,
      label_name: pt.label_name.trim() || null,
      share_percentage: num(pt.share) / 100,
      share_physical: pt.advanced && pt.sharePhysical.trim() ? num(pt.sharePhysical) / 100 : null,
      share_digital: pt.advanced && pt.shareDigital.trim() ? num(pt.shareDigital) / 100 : null,
      contact_email: pt.contact_email.trim() || null,
      contact_phone: pt.contact_phone.trim() || null,
    }));

    setBusy(true);
    try {
      if (isEdit) {
        await updateContract(id, {
          start_date: startDate.trim(),
          end_date: endDate.trim() || null,
          description: description.trim() || null,
          parties: partyPayload,
        });
      } else {
        await createContract({
          scope,
          scope_id: scope === 'catalog' ? null : scopeId.trim(),
          start_date: startDate.trim(),
          end_date: endDate.trim() || null,
          description: description.trim() || null,
          artist_id: artist!.id,
          parties: partyPayload,
        });
      }
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: p.text, fontSize: 14.5, marginTop: 6,
  } as const;
  const labelStyle = { color: p.text2, fontSize: 12.5, fontWeight: '600' as const, marginTop: 12 };

  const Chip = ({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? p.accent : p.surface2, borderColor: active ? p.accent : p.border, borderWidth: 1 }}>
      <Text style={{ color: active ? p.accentInk : p.text2, fontSize: 12.5, fontWeight: '700' }}>{children}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={labelStyle}>{t('cform.artist')}</Text>
            <Pressable
              disabled={isEdit}
              onPress={() => setPickerFor('primary')}
              style={[inputStyle, { opacity: isEdit ? 0.6 : 1, flexDirection: 'row', justifyContent: 'space-between' }]}
            >
              <Text style={{ color: artist ? p.text : p.text3, fontSize: 14.5 }}>{label(artist)}</Text>
            </Pressable>

            <Text style={labelStyle}>{t('cform.scope')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              {SCOPES.map((s) => (
                <Chip key={s} active={scope === s} onPress={() => !isEdit && setScope(s)}>{t(`contracts.scope.${s}`)}</Chip>
              ))}
            </View>

            {scope !== 'catalog' ? (
              <>
                <Text style={labelStyle}>{t('cform.scopeId')}</Text>
                <TextInput value={scopeId} onChangeText={setScopeId} editable={!isEdit} autoCapitalize="characters" autoCorrect={false} placeholder="ISRC / UPC" placeholderTextColor={p.text3} style={[inputStyle, { opacity: isEdit ? 0.6 : 1 }]} />
              </>
            ) : null}

            <Text style={labelStyle}>{t('cform.start')}</Text>
            <TextInput value={startDate} onChangeText={setStartDate} autoCapitalize="none" autoCorrect={false} placeholder="2026-01-01" placeholderTextColor={p.text3} style={inputStyle} />

            <Text style={labelStyle}>{t('cform.end')}</Text>
            <TextInput value={endDate} onChangeText={setEndDate} autoCapitalize="none" autoCorrect={false} placeholder="—" placeholderTextColor={p.text3} style={inputStyle} />

            <Text style={labelStyle}>{t('cform.description')}</Text>
            <TextInput value={description} onChangeText={setDescription} multiline placeholder="—" placeholderTextColor={p.text3} style={[inputStyle, { minHeight: 60 }]} />
          </Card>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle>{t('cform.parties')}</SectionTitle>
            <Text style={{ color: totalOk ? p.accent : p.neg, fontSize: 13, fontWeight: '800' }}>
              {t('cform.total')}: {Math.round(total * 100) / 100} %
            </Text>
          </View>

          {parties.map((pt, i) => (
            <Card key={i}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {PARTY_TYPES.map((tp) => (
                  <Chip key={tp} active={pt.party_type === tp} onPress={() => setParty(i, { party_type: tp })}>{PARTY_LABELS[tp]}</Chip>
                ))}
              </View>

              {pt.party_type === 'artist' ? (
                <>
                  <TextInput value={pt.label_name} onChangeText={(v) => setParty(i, { label_name: v })} placeholder={t('cform.artistName')} placeholderTextColor={p.text3} style={inputStyle} />
                  <Pressable onPress={() => setPickerFor(i)} style={[inputStyle, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={{ color: pt.artist ? p.text : p.text3, fontSize: 13.5 }}>{pt.artist ? label(pt.artist) : t('cform.artistLink')}</Text>
                    <IconChevronRight size={16} color={p.text3} />
                  </Pressable>
                </>
              ) : (
                <TextInput value={pt.label_name} onChangeText={(v) => setParty(i, { label_name: v })} placeholder={t('cform.name')} placeholderTextColor={p.text3} style={inputStyle} />
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600' }}>{t('cform.share')}</Text>
                <TextInput value={pt.share} onChangeText={(v) => setParty(i, { share: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={p.text3} style={[inputStyle, { flex: 1, marginTop: 0 }]} />
                {parties.length > 1 ? (
                  <Pressable onPress={() => removeParty(i)} hitSlop={8}><Text style={{ color: p.neg, fontSize: 13, fontWeight: '700' }}>✕</Text></Pressable>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: p.text3, fontSize: 12 }}>{t('cform.advanced')}</Text>
                <Switch value={pt.advanced} onValueChange={(v) => setParty(i, { advanced: v })} trackColor={{ true: p.accent }} thumbColor="#fff" />
              </View>
              {pt.advanced ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput value={pt.sharePhysical} onChangeText={(v) => setParty(i, { sharePhysical: v })} keyboardType="decimal-pad" placeholder={t('contracts.physical')} placeholderTextColor={p.text3} style={[inputStyle, { flex: 1 }]} />
                  <TextInput value={pt.shareDigital} onChangeText={(v) => setParty(i, { shareDigital: v })} keyboardType="decimal-pad" placeholder={t('contracts.digital')} placeholderTextColor={p.text3} style={[inputStyle, { flex: 1 }]} />
                </View>
              ) : null}
            </Card>
          ))}

          <Pressable onPress={addParty} style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderColor: p.border, borderWidth: 1, borderStyle: 'dashed', opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: p.accent, fontWeight: '700', fontSize: 13.5 }}>＋ {t('cform.addParty')}</Text>
          </Pressable>

          <View style={{ marginTop: 6 }}>
            <AccentButton label={t('common.save')} onClick={submit} loading={busy} disabled={!totalOk} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ArtistPicker
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(a) => {
          if (pickerFor === 'primary') setArtist(a);
          else if (typeof pickerFor === 'number') setParty(pickerFor, { artist: a });
        }}
      />
    </SafeAreaView>
  );
}
