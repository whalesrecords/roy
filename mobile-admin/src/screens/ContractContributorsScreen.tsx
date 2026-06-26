import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, AccentButton } from '@/components/ui';
import { FormScreen } from '@/components/form';
import { State, SectionTitle } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getContractContributors, setContractContributors, getReleaseTracks, TrackContributor } from '@/lib/api';

const ROLES = ['composer', 'author', 'performer', 'musician', 'producer', 'arranger', 'publisher', 'other'];

interface Row { key: string; isrc: string | null; track_title: string | null; name: string; role: string; pct: string }

let _seq = 0;
const newKey = () => `r${_seq++}`;

export default function ContractContributorsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, scope, scopeId, scopeTitle } = route.params || {};

  const contribQ = useFetch(() => getContractContributors(id), [id], `contributors:${id}`);
  // Album tracks (only for release scope).
  const tracksQ = useFetch(
    () => (scope === 'release' && scopeId ? getReleaseTracks(scopeId) : Promise.resolve([])),
    [scope, scopeId],
    `rel-trk:${scopeId || 'none'}`,
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    nav.setOptions?.({ title: t('contributors.title') });
  }, [nav, t]);

  // Seed rows from saved contributors once loaded.
  useEffect(() => {
    if (!contribQ.data) return;
    setRows(
      contribQ.data.contributors.map((c) => ({
        key: newKey(),
        isrc: c.isrc ?? null,
        track_title: c.track_title ?? null,
        name: c.contributor_name || '',
        role: c.role || 'composer',
        pct: c.percentage != null ? String(c.percentage) : '',
      })),
    );
  }, [contribQ.data]);

  // Build the list of track "sections" to render.
  const sections = useMemo(() => {
    if (scope === 'release') {
      const fromAlbum = (tracksQ.data || []).map((tk) => ({ isrc: tk.isrc || null, title: tk.track_title }));
      // include any contributor isrcs not present in the album list
      const known = new Set(fromAlbum.map((s) => s.isrc));
      const extra = rows
        .filter((r) => r.isrc && !known.has(r.isrc))
        .map((r) => ({ isrc: r.isrc, title: r.track_title || r.isrc }));
      const dedupExtra = Array.from(new Map(extra.map((e) => [e.isrc, e])).values());
      return [...fromAlbum, ...dedupExtra];
    }
    if (scope === 'track') return [{ isrc: scopeId || null, title: scopeTitle || scopeId }];
    return [{ isrc: null, title: t('contributors.whole') }];
  }, [scope, scopeId, scopeTitle, tracksQ.data, rows, t]);

  const addRow = (isrc: string | null, title: string | null) =>
    setRows((rs) => [...rs, { key: newKey(), isrc, track_title: title, name: '', role: 'composer', pct: '' }]);
  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = async () => {
    const payload: TrackContributor[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        isrc: r.isrc,
        track_title: r.track_title,
        contributor_name: r.name.trim(),
        role: r.role,
        percentage: r.pct.trim() ? parseFloat(r.pct.replace(',', '.')) : null,
      }));
    setBusy(true);
    try {
      await setContractContributors(id, payload);
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  const input = {
    backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 8, color: p.text, fontSize: 14,
  } as const;

  return (
    <FormScreen>
      {scopeTitle ? <SectionTitle>{scopeTitle}</SectionTitle> : null}
      <State loading={contribQ.loading || tracksQ.loading} error={contribQ.error} onRetry={contribQ.reload} empty={scope === 'release' && sections.length === 0}>
        {sections.map((s) => {
          const trackRows = rows.filter((r) => (r.isrc || null) === (s.isrc || null));
          return (
            <Card key={s.isrc || 'whole'}>
              <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '800' }} numberOfLines={2}>{s.title}</Text>
              {s.isrc ? <Text style={{ color: p.text3, fontSize: 11, marginTop: 1 }}>{s.isrc}</Text> : null}

              {trackRows.length === 0 ? (
                <Text style={{ color: p.text3, fontSize: 12, marginTop: 8 }}>{t('contributors.none')}</Text>
              ) : null}

              {trackRows.map((r) => (
                <View key={r.key} style={{ marginTop: 12, borderTopColor: p.border, borderTopWidth: 1, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={r.name} onChangeText={(v) => patchRow(r.key, { name: v })}
                      placeholder={t('contributors.name')} placeholderTextColor={p.text3}
                      style={[input, { flex: 1 }]}
                    />
                    <TextInput
                      value={r.pct} onChangeText={(v) => patchRow(r.key, { pct: v })}
                      keyboardType="decimal-pad" placeholder="%" placeholderTextColor={p.text3}
                      style={[input, { width: 64, textAlign: 'center' }]}
                    />
                    <Pressable onPress={() => removeRow(r.key)} hitSlop={8}>
                      <Text style={{ color: p.neg, fontWeight: '800', fontSize: 15 }}>✕</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {ROLES.map((role) => {
                      const active = r.role === role;
                      return (
                        <Pressable key={role} onPress={() => patchRow(r.key, { role })} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: active ? p.accent : p.surface2, borderColor: active ? p.accent : p.border, borderWidth: 1 }}>
                          <Text style={{ color: active ? p.accentInk : p.text2, fontSize: 11.5, fontWeight: '700' }}>{t(`role.${role}`)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Pressable onPress={() => addRow(s.isrc, s.title)} style={({ pressed }) => ({ marginTop: 12, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderColor: p.border, borderWidth: 1, borderStyle: 'dashed', opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ color: p.accent, fontWeight: '700', fontSize: 12.5 }}>＋ {t('contributors.add')}</Text>
              </Pressable>
            </Card>
          );
        })}
      </State>

      <AccentButton label={t('contributors.save')} onClick={save} loading={busy} />
    </FormScreen>
  );
}
