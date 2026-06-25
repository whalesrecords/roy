import React, { ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, TextStyle, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Loader } from '@/components/ui';
import { LabelLogo } from '@/components/LabelLogo';
import { IconChevronRight } from '@/components/icons';

/** Standard screen shell: safe area + header (logo + title) + scroll + pull-to-refresh. */
export function Screen({
  title, children, onRefresh, refreshing, right, scroll = true,
}: {
  title?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean;
  right?: ReactNode; scroll?: boolean;
}) {
  const p = usePalette();
  const header = (
    <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <LabelLogo height={22} />
        {title ? <Text style={{ color: p.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>{title}</Text> : null}
      </View>
      {right}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: 36, gap: 14 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.accent} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** Loading / error / empty resolution for a data screen. */
export function State({
  loading, error, empty, onRetry, children,
}: { loading: boolean; error?: string | null; empty?: boolean; onRetry?: () => void; children: ReactNode }) {
  const p = usePalette();
  const { t } = useLanguage();
  if (loading) return <Loader />;
  if (error) {
    return (
      <Card>
        <Text style={{ color: p.neg, fontSize: 14, fontWeight: '600' }}>{t('common.error')}</Text>
        <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 4 }}>{error}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={{ marginTop: 12 }}>
            <Text style={{ color: p.accent, fontWeight: '700' }}>{t('common.retry')}</Text>
          </Pressable>
        ) : null}
      </Card>
    );
  }
  if (empty) {
    return (
      <Card><Text style={{ color: p.text3, fontSize: 13.5, textAlign: 'center' }}>{t('common.empty')}</Text></Card>
    );
  }
  return <>{children}</>;
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const p = usePalette();
  return <Text style={[{ color: p.text, fontSize: 15, fontWeight: '800', marginTop: 4, marginBottom: 2 }, style]}>{children}</Text>;
}

/** A tappable list row with a chevron. */
export function Row({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const p = usePalette();
  const inner = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, style]}>
      <View style={{ flex: 1 }}>{children}</View>
      {onPress ? <IconChevronRight size={18} color={p.text3} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{inner}</Pressable>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.border }} />;
}

/** Horizontal bar showing a value's share of a total, accent-colored. */
export function BarRow({ label, value, pct, sub }: { label: string; value: string; pct: number; sub?: string }) {
  const p = usePalette();
  const w = Math.max(2, Math.min(100, Math.round(pct)));
  return (
    <View style={{ marginVertical: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: p.text2, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: p.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      <View style={{ height: 7, borderRadius: 999, backgroundColor: p.track, overflow: 'hidden' }}>
        <View style={{ height: 7, borderRadius: 999, backgroundColor: p.accent, width: `${w}%` }} />
      </View>
      {sub ? <Text style={{ color: p.text3, fontSize: 11, marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
}

/** Coloured status chip. Semantics: green=done/locked/resolved, amber=in-progress, neutral=open. */
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const p = usePalette();
  const map = {
    neutral: { bg: p.track, fg: p.text2 },
    good: { bg: p.accentSoft, fg: p.accent },
    warn: { bg: 'rgba(227,179,65,0.16)', fg: '#C9982B' },
    bad: { bg: 'rgba(220,76,87,0.14)', fg: p.neg },
  } as const;
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export { Eyebrow };
