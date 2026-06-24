import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';

/** Écran provisoire — sera remplacé par l'implémentation complète (phases suivantes). */
export function makePlaceholder(title: string) {
  return function PlaceholderScreen() {
    const p = usePalette();
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: p.text3, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            Écran en cours de construction — disponible dans la prochaine phase.
          </Text>
        </View>
      </SafeAreaView>
    );
  };
}
