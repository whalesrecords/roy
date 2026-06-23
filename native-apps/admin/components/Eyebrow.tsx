import { Text, TextStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

export function Eyebrow({ children, style }: { children: string; style?: TextStyle }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        {
          ...tokens.type.eyebrow,
          color: tokens.text3,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
