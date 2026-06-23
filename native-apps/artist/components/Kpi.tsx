import { Text, View } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { Card } from './Card';
import { Eyebrow } from './Eyebrow';

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

export function Kpi({ label, value, hint, accent = false }: KpiProps) {
  const { tokens } = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <Eyebrow>{label}</Eyebrow>
      <Text
        style={{
          ...tokens.type.kpiNum,
          color: accent ? tokens.accent : tokens.text,
          fontVariant: ['tabular-nums'],
          marginTop: 6,
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 10.5, color: tokens.text3, marginTop: 2 }}>{hint}</Text>
      ) : null}
    </Card>
  );
}
