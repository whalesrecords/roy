import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';

export default function ArtistsScreen() {
  const { tokens } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg, padding: 20 }}>
      <Text style={{ ...tokens.type.h1, color: tokens.text }}>Artistes</Text>
      <Text style={{ color: tokens.text3, fontSize: 12, marginTop: 4 }}>
        Search + liste + sheet détail. Skeleton.
      </Text>
      <View style={{ marginTop: 24, padding: 22, borderRadius: tokens.radius.hero, backgroundColor: tokens.hero, borderColor: tokens.border, borderWidth: 1 }}>
        <Text style={{ ...tokens.type.eyebrow, color: tokens.text3 }}>EN COURS DE DÉVELOPPEMENT</Text>
        <Text style={{ color: tokens.text, marginTop: 8, fontSize: 14, lineHeight: 20 }}>
          Liste des artistes avec recherche, avatar (image_url_small), revenus + streams.
        </Text>
      </View>
    </SafeAreaView>
  );
}
