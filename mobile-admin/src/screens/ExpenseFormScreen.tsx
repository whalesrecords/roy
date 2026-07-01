import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, AccentButton } from '@/components/ui';
import { FormScreen, Field, Chips } from '@/components/form';
import { ArtistPicker } from '@/components/ArtistPicker';
import { IconLogout, IconChevronRight } from '@/components/icons';
import { createExpense, updateExpense, deleteExpense, ExpenseInput, ExpenseResponse } from '@/lib/api';

type Scope = 'catalog' | 'track' | 'release';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'catalog', label: 'Catalogue' }, { value: 'release', label: 'Release' }, { value: 'track', label: 'Titre' },
];
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'mastering', label: 'Mastering' }, { value: 'mixing', label: 'Mixage' }, { value: 'recording', label: 'Enregistrement' },
  { value: 'photos', label: 'Photos' }, { value: 'video', label: 'Vidéo' }, { value: 'advertising', label: 'Publicité' },
  { value: 'groover', label: 'Groover' }, { value: 'submithub', label: 'SubmitHub' }, { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' }, { value: 'tiktok', label: 'TikTok' }, { value: 'facebook', label: 'Facebook' },
  { value: 'spotify_ads', label: 'Spotify Ads' }, { value: 'pr', label: 'PR / Presse' }, { value: 'distribution', label: 'Distribution' },
  { value: 'artwork', label: 'Artwork' }, { value: 'cd', label: 'CD' }, { value: 'vinyl', label: 'Vinyles' },
  { value: 'goodies', label: 'Goodies / Merch' }, { value: 'accommodation', label: 'Hébergement' },
  { value: 'equipment_rental', label: 'Location matériel' }, { value: 'other', label: 'Autre' },
];

export default function ExpenseFormScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, prefill } = route.params || {};
  const isEdit = !!id;
  const e: ExpenseResponse | undefined = prefill;

  const [amount, setAmount] = useState(e?.amount || '');
  const [currency, setCurrency] = useState(e?.currency || 'EUR');
  const [scope, setScope] = useState<Scope>((e?.scope as Scope) || 'catalog');
  const [scopeId, setScopeId] = useState(e?.scope_id || '');
  const [category, setCategory] = useState<string>(e?.category || 'other');
  const [description, setDescription] = useState(e?.description || '');
  const [reference, setReference] = useState(e?.reference || '');
  const [date, setDate] = useState((e?.effective_date || '').slice(0, 10));
  const [artist, setArtist] = useState<{ id: string; name: string } | null>(
    e?.artist_id ? { id: e.artist_id, name: e.artist_name || '' } : null,
  );
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    nav.setOptions?.({ title: isEdit ? 'Modifier la dépense' : 'Nouvelle dépense' });
  }, [nav, isEdit]);

  const submit = async () => {
    const amt = amount.replace(',', '.');
    if (!amt || !isFinite(parseFloat(amt)) || parseFloat(amt) <= 0) { Alert.alert('', 'Montant invalide.'); return; }
    if (scope !== 'catalog' && !scopeId.trim()) { Alert.alert('', 'Identifiant requis pour ce périmètre.'); return; }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { Alert.alert('', 'Date invalide (AAAA-MM-JJ).'); return; }

    const payload: ExpenseInput = {
      amount: amt, currency: currency.trim() || 'EUR', scope,
      scope_id: scope === 'catalog' ? null : scopeId.trim(),
      category, description: description.trim() || null, reference: reference.trim() || null,
      effective_date: date.trim() || null, artist_id: artist?.id ?? null,
    };
    setBusy(true);
    try {
      if (isEdit) await updateExpense(id, payload);
      else await createExpense(payload);
      nav.goBack();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Supprimer la dépense', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await deleteExpense(id); nav.goBack(); } catch (err: any) { Alert.alert('Erreur', err?.message || ''); }
      } },
    ]);
  };

  return (
    <FormScreen>
      <Card>
        <Field label="Montant" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Field label="Devise" value={currency} onChangeText={setCurrency} autoCapitalize="characters" placeholder="EUR" />
        <Chips label="Périmètre" options={SCOPES} value={scope} onChange={setScope} />
        {scope !== 'catalog' ? (
          <Field label="Identifiant (ISRC / UPC)" value={scopeId} onChangeText={setScopeId} autoCapitalize="characters" autoCorrect={false} placeholder="ISRC / UPC" />
        ) : null}
        <Chips label="Catégorie" options={CATEGORIES} value={category} onChange={setCategory} />
        <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600', marginTop: 12 }}>Artiste (optionnel)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <Pressable onPress={() => setPicker(true)} accessibilityLabel="Choisir artiste" accessibilityRole="button" style={{ flex: 1, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={{ color: artist ? p.text : p.text3, fontSize: 14.5 }}>{artist ? (artist.name || 'Artiste') : 'Aucun'}</Text>
            <IconChevronRight size={16} color={p.text3} />
          </Pressable>
          {artist ? <Pressable onPress={() => setArtist(null)} hitSlop={8} accessibilityLabel="Retirer l'artiste" accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.neg, fontWeight: '700' }}>✕</Text></Pressable> : null}
        </View>
        <Field label="Description" value={description} onChangeText={setDescription} placeholder="—" multiline />
        <Field label="Référence (facture, contrat…)" value={reference} onChangeText={setReference} placeholder="—" />
        <Field label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-01-01" />
      </Card>

      <AccentButton label={t('common.save')} onClick={submit} loading={busy} />

      {isEdit ? (
        <Pressable onPress={confirmDelete} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, backgroundColor: 'rgba(220,76,87,0.1)', borderRadius: 12, opacity: pressed ? 0.7 : 1 })}>
          <IconLogout size={17} color={p.neg} />
          <Text style={{ color: p.neg, fontWeight: '700', fontSize: 14 }}>{t('common.delete')}</Text>
        </Pressable>
      ) : null}

      <ArtistPicker visible={picker} onClose={() => setPicker(false)} onSelect={(a) => setArtist(a)} />
    </FormScreen>
  );
}
