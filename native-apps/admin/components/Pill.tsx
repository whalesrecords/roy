import { Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export function Pill({ children, tone = 'accent' }: { children: string; tone?: 'accent' | 'neutral' }) {
  const { tokens } = useTheme();
  const bg = tone === 'accent' ? tokens.accentSoft : tokens.surface2;
  const fg = tone === 'accent' ? tokens.accent : tokens.text2;
  return (
    <View style={{ backgroundColor: bg, borderRadius: tokens.radius.pill, paddingHorizontal: 11, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}
