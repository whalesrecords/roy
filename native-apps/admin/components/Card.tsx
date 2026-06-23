import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../lib/ThemeContext';

interface CardProps {
  children: ReactNode;
  hero?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function Card({ children, hero = false, padded = true, style }: CardProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: hero ? tokens.hero : tokens.surface,
          borderColor: tokens.border,
          borderWidth: 1,
          borderRadius: hero ? tokens.radius.hero : tokens.radius.card,
          padding: padded ? 17 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
