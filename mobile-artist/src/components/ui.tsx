import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Animated, Image,
} from 'react-native';
import Svg, { Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';
import { usePalette } from '@/theme/ThemeProvider';
import { subscribeLoading } from '@/lib/api';

export function Card({ children, style, hero }: { children: ReactNode; style?: ViewStyle; hero?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: hero ? p.hero : p.surface,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 18,
          shadowColor: '#101828',
          shadowOpacity: 0.05,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const p = usePalette();
  return (
    <Text style={[{ color: p.text3, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }, style]}>
      {children}
    </Text>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.accentSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function Money({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const p = usePalette();
  return <Text style={[{ color: p.text, fontVariant: ['tabular-nums'], letterSpacing: -0.3 }, style]}>{children}</Text>;
}

export function AccentButton({ label, onClick, disabled, loading, icon }: {
  label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; icon?: ReactNode;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onClick}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: p.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={p.accentInk} /> : icon}
      <Text style={{ color: p.accentInk, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function KpiTile({ label, value, hint, accentValue, style }: {
  label: string; value: string; hint?: string; accentValue?: boolean; style?: ViewStyle;
}) {
  const p = usePalette();
  return (
    <Card style={style}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 22, fontWeight: '800', marginTop: 6, color: accentValue ? p.accent : p.text }}>{value}</Money>
      {hint ? <Text style={{ color: p.text3, fontSize: 11, marginTop: 4 }}>{hint}</Text> : null}
    </Card>
  );
}

export function Cover({ size = 46, radius = 10, uri }: { size?: number; radius?: number; uri?: string | null }) {
  const p = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: p.coverTo }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} /> : null}
    </View>
  );
}

/** Mini courbe (sparkline) en SVG. */
export function Sparkline({ points, width = 280, height = 32 }: { points: number[]; width?: number; height?: number }) {
  const p = usePalette();
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.accent} stopOpacity={0.9} />
          <Stop offset="1" stopColor={p.accent} stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      <Polyline points={coords} fill="none" stroke="url(#spark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const p = usePalette();
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: p.track, overflow: 'hidden', marginTop: 12 }}>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: p.accent, width: `${pct}%` }} />
    </View>
  );
}

/** Barre de progression globale (haut de l'écran) pilotée par les requêtes API. */
export function TopProgressBar() {
  const p = usePalette();
  const [visible, setVisible] = useState(false);
  const width = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeLoading((loading) => {
      if (loading) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        setVisible(true);
        opacity.setValue(1);
        width.setValue(0.08);
        Animated.timing(width, { toValue: 0.9, duration: 1400, useNativeDriver: false }).start();
      } else {
        Animated.timing(width, { toValue: 1, duration: 200, useNativeDriver: false }).start();
        hideTimer = setTimeout(() => {
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
            setVisible(false);
            width.setValue(0);
          });
        }, 250);
      }
    });
    return () => { unsub(); if (hideTimer) clearTimeout(hideTimer); };
  }, [opacity, width]);

  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { bottom: undefined, height: 3, zIndex: 100, opacity }]} pointerEvents="none">
      <Animated.View
        style={{ height: 3, backgroundColor: p.accent, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
      />
    </Animated.View>
  );
}

export function Loader() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      <ActivityIndicator size="large" color={p.accent} />
    </View>
  );
}
