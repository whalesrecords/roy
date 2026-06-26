import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Switch, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, AccentButton } from '@/components/ui';
import { SectionTitle } from '@/components/kit';
import { FormScreen, Field, Chips, SwitchRow } from '@/components/form';
import { IconLogout } from '@/components/icons';
import { createProduct, updateProduct, deleteProduct, adjustStock, ProductInput, Product } from '@/lib/api';
import { fmtNum } from '@/lib/format';

const FORMATS = [
  { value: 'vinyl', label: 'Vinyle' }, { value: 'cd', label: 'CD' }, { value: 'cassette', label: 'K7' },
  { value: 'merch', label: 'Merch' }, { value: 'bundle', label: 'Bundle' }, { value: 'other', label: 'Autre' },
];
const STATUSES = [
  { value: 'available', label: 'Disponible' }, { value: 'sold_out', label: 'Épuisé' },
  { value: 'preorder', label: 'Précommande' }, { value: 'discontinued', label: 'Arrêté' },
];

const numOrNull = (v: string): number | null => {
  const n = parseFloat(v.replace(',', '.'));
  return v.trim() && isFinite(n) ? n : null;
};

export default function ProductFormScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, prefill } = route.params || {};
  const isEdit = !!id;
  const pr: Product | undefined = prefill;

  const [title, setTitle] = useState(pr?.title || '');
  const [format, setFormat] = useState(pr?.format || 'vinyl');
  const [variant, setVariant] = useState(pr?.variant || '');
  const [sku, setSku] = useState(pr?.sku || '');
  const [upc, setUpc] = useState(pr?.release_upc || '');
  const [artistName, setArtistName] = useState(pr?.artist_name || '');
  const [price, setPrice] = useState(pr?.price_eur != null ? String(pr.price_eur) : '');
  const [cost, setCost] = useState(pr?.cost_eur != null ? String(pr.cost_eur) : '');
  const [stock, setStock] = useState(pr?.stock_quantity != null ? String(pr.stock_quantity) : '0');
  const [threshold, setThreshold] = useState(pr?.low_stock_threshold != null ? String(pr.low_stock_threshold) : '10');
  const [status, setStatus] = useState(pr?.status || 'available');
  const [limited, setLimited] = useState(!!pr?.limited_edition);
  const [editionSize, setEditionSize] = useState(pr?.edition_size != null ? String(pr.edition_size) : '');
  const [imageUrl, setImageUrl] = useState(pr?.image_url || '');
  const [notes, setNotes] = useState(pr?.notes || '');
  const [busy, setBusy] = useState(false);

  // Edit-mode stock adjustment (PUT does not change stock; the stock endpoint does).
  const [curStock, setCurStock] = useState(pr?.stock_quantity ?? 0);
  const [delta, setDelta] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  React.useEffect(() => {
    nav.setOptions?.({ title: isEdit ? 'Modifier le produit' : 'Nouveau produit' });
  }, [nav, isEdit]);

  const submit = async () => {
    if (!title.trim()) { Alert.alert('', 'Le titre est requis.'); return; }
    const base: ProductInput = {
      title: title.trim(), format, variant: variant.trim() || null, sku: sku.trim() || null,
      release_upc: upc.trim() || null, artist_name: artistName.trim() || null,
      price_eur: numOrNull(price), cost_eur: numOrNull(cost),
      low_stock_threshold: parseInt(threshold, 10) || 0, status,
      limited_edition: limited, edition_size: editionSize.trim() ? parseInt(editionSize, 10) : null,
      image_url: imageUrl.trim() || null, notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (isEdit) await updateProduct(id, base);
      else await createProduct({ ...base, stock_quantity: parseInt(stock, 10) || 0, initial_stock_quantity: parseInt(stock, 10) || 0 });
      nav.goBack();
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const applyAdjust = async () => {
    const q = parseInt(delta.replace(/\s/g, ''), 10);
    if (!q || !isFinite(q)) { Alert.alert('', 'Quantité invalide (ex. -5 ou 20).'); return; }
    setAdjusting(true);
    try {
      const updated = await adjustStock(id, { quantity: q, movement_type: 'adjustment', source: 'manual' });
      setCurStock(updated.stock_quantity);
      setDelta('');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || '');
    } finally {
      setAdjusting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Supprimer le produit', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await deleteProduct(id); nav.goBack(); } catch (err: any) { Alert.alert('Erreur', err?.message || ''); }
      } },
    ]);
  };

  return (
    <FormScreen>
      <Card>
        <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Nom du produit" />
        <Chips label="Format" options={FORMATS} value={format} onChange={setFormat} />
        <Field label="Variante" value={variant} onChangeText={setVariant} placeholder="ex. Vinyle noir, T-shirt rouge XL" />
        <Field label="SKU" value={sku} onChangeText={setSku} autoCapitalize="characters" placeholder="—" />
        <Field label="UPC release" value={upc} onChangeText={setUpc} autoCapitalize="characters" placeholder="—" />
        <Field label="Artiste" value={artistName} onChangeText={setArtistName} placeholder="—" />
      </Card>

      <Card>
        <Field label="Prix de vente (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
        <Field label="Coût (€)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" />
        {!isEdit ? (
          <Field label="Stock initial" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" />
        ) : null}
        <Field label="Seuil stock faible" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" placeholder="10" />
        <Chips label="Statut" options={STATUSES} value={status} onChange={setStatus} />
        <SwitchRow label="Édition limitée" value={limited} onValueChange={setLimited}>
          <Switch value={limited} onValueChange={setLimited} trackColor={{ true: p.accent }} thumbColor="#fff" />
        </SwitchRow>
        {limited ? <Field label="Taille de l'édition" value={editionSize} onChangeText={setEditionSize} keyboardType="number-pad" placeholder="—" /> : null}
        <Field label="Image (URL)" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" placeholder="https://…" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="—" multiline />
      </Card>

      {isEdit ? (
        <Card>
          <SectionTitle>Ajuster le stock</SectionTitle>
          <Text style={{ color: p.text2, fontSize: 13, marginTop: 4 }}>Stock actuel : <Text style={{ color: p.text, fontWeight: '800' }}>{fmtNum(curStock)}</Text></Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <TextInput
              value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" placeholder="ex. -5 ou +20" placeholderTextColor={p.text3}
              style={{ flex: 1, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: p.text, fontSize: 14.5 }}
            />
            <Pressable onPress={applyAdjust} disabled={adjusting} style={({ pressed }) => ({ backgroundColor: p.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, opacity: adjusting ? 0.5 : pressed ? 0.85 : 1 })}>
              <Text style={{ color: p.accentInk, fontWeight: '800', fontSize: 13.5 }}>Appliquer</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <AccentButton label={t('common.save')} onClick={submit} loading={busy} />

      {isEdit ? (
        <Pressable onPress={confirmDelete} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, backgroundColor: 'rgba(220,76,87,0.1)', borderRadius: 12, opacity: pressed ? 0.7 : 1 })}>
          <IconLogout size={17} color={p.neg} />
          <Text style={{ color: p.neg, fontWeight: '700', fontSize: 14 }}>{t('common.delete')}</Text>
        </Pressable>
      ) : null}
    </FormScreen>
  );
}
