import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Modal, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { Avatar } from '@/components/ui';
import { IconSearch } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getArtistsSummary } from '@/lib/api';

/** Full-screen modal to pick an artist. Reuses the cached artists list. */
export function ArtistPicker({
  visible, onClose, onSelect,
}: { visible: boolean; onClose: () => void; onSelect: (a: { id: string; name: string }) => void }) {
  const p = usePalette();
  const { data } = useFetch(getArtistsSummary, [], 'artists');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const arr = [...(data || [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!q.trim()) return arr;
    const n = q.trim().toLowerCase();
    return arr.filter((a) => a.name.toLowerCase().includes(n));
  }, [data, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '800' }}>Choisir un artiste</Text>
          <Pressable onPress={onClose}><Text style={{ color: p.accent, fontWeight: '700', fontSize: 15 }}>Fermer</Text></Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
            <IconSearch size={18} color={p.text3} />
            <TextInput
              value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={p.text3}
              autoCapitalize="none" autoCorrect={false}
              style={{ flex: 1, color: p.text, fontSize: 15, paddingVertical: 11 }}
            />
          </View>
        </View>
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect({ id: item.id, name: item.name }); onClose(); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}
            >
              <Avatar name={item.name} uri={item.image_url_small || item.image_url} size={36} />
              <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '600' }}>{item.name}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
