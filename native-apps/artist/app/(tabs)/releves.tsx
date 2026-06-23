import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';

export default function RelevesScreen() {
  const { tokens } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg, padding: 20 }}>
      <Text style={{ ...tokens.type.h1, color: tokens.text }}>Releves</Text>
      <View style={{ marginTop: 24, padding: 22, borderRadius: tokens.radius.hero, backgroundColor: tokens.hero, borderColor: tokens.border, borderWidth: 1 }}>
        <Text style={{ ...tokens.type.eyebrow, color: tokens.text3 }}>EN COURS DE DÉVELOPPEMENT</Text>
        <Text style={{ color: tokens.text, marginTop: 8, fontSize: 14, lineHeight: 20 }}>
          Reprend le design du prototype HTML — connecté aux endpoints artist-portal.
        </Text>
      </View>
    </SafeAreaView>
  );
}
