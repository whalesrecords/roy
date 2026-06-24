import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getPlatformStats, getQuarterlyRevenue, getAvailableYears, invalidateCache,
  PlatformStats, QuarterlyRevenue,
} from '@/lib/api';
import { Card, Eyebrow, Money, Sparkline, Loader } from '@/components/ui';
import { fmtMoney, fmtNum } from '@/lib/format';

const PLATFORM_COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#00C7F2', '#8b5cf6', '#f97316', '#ec4899'];

export default function StatsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [stats, setStats] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadYears = useCallback(async () => {
    const d = await getAvailableYears();
    const ys = d.years.length ? d.years : [new Date().getFullYear()];
    setYears(ys);
    setYear((y) => (y === 0 ? d.default_year || ys[0] : y));
  }, []);

  const loadData = useCallback(async (yr: number) => {
    const [s, q] = await Promise.all([getPlatformStats(yr), getQuarterlyRevenue(yr)]);
    setStats(s);
    setQuarterly(q.filter((x) => parseFloat(x.gross) > 0 || x.streams > 0));
  }, []);

  useEffect(() => { loadYears(); }, [loadYears]);
  useEffect(() => {
    if (year === 0) return;
    (async () => { setLoading(true); try { await loadData(year); } finally { setLoading(false); } })();
  }, [year, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateCache('/artist-portal');
    try { await loadData(year); } finally { setRefreshing(false); }
  };

  const currency = quarterly[0]?.currency || 'EUR';
  const totalGross = stats.reduce((s, x) => s + parseFloat(x.gross), 0);
  const totalStreams = stats.reduce((s, x) => s + x.streams, 0);
  const totalNet = quarterly.reduce((s, x) => s + parseFloat(x.net), 0);
  const sorted = [...stats].sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross));
  const maxGross = sorted.length ? parseFloat(sorted[0].gross) : 0;
  const sparkPoints = quarterly.map((q) => parseFloat(q.gross));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('stats.title')}</Text>

        {/* Year selector */}
        {years.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {years.map((y) => (
                <Pressable key={y} onPress={() => setYear(y)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: y === year ? p.accentSoft : p.surface, borderColor: y === year ? p.accent : p.border, borderWidth: 1 }}>
                  <Text style={{ color: y === year ? p.accent : p.text2, fontWeight: '600', fontSize: 13 }}>{y}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {loading ? <Loader /> : stats.length === 0 ? (
          <Text style={{ color: p.text3, textAlign: 'center', paddingVertical: 40 }}>Aucune donnée pour {year}</Text>
        ) : (
          <>
            {/* Hero */}
            <Card hero>
              <Eyebrow>{t('common.grossRevenue')} · {year}</Eyebrow>
              <Money style={{ fontSize: 40, fontWeight: '800', marginTop: 8 }}>{fmtMoney(totalGross, currency)}</Money>
              <Text style={{ color: p.text2, fontSize: 12.5, marginTop: 8 }}>Net royalties <Money style={{ fontWeight: '700' }}>{fmtMoney(totalNet, currency)}</Money></Text>
              {sparkPoints.length > 1 ? <View style={{ marginTop: 14 }}><Sparkline points={sparkPoints} width={300} height={40} /></View> : null}
            </Card>

            {/* KPIs */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card style={{ flex: 1 }}>
                <Eyebrow>Streams</Eyebrow>
                <Money style={{ fontSize: 22, fontWeight: '800', marginTop: 6 }}>{fmtNum(totalStreams)}</Money>
              </Card>
              <Card style={{ flex: 1 }}>
                <Eyebrow>Net royalties</Eyebrow>
                <Money style={{ fontSize: 22, fontWeight: '800', marginTop: 6 }}>{fmtMoney(totalNet, currency)}</Money>
              </Card>
            </View>

            {/* Platforms */}
            <Card>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700', marginBottom: 14 }}>Par plateforme</Text>
              {sorted.map((s, i) => {
                const pct = maxGross > 0 ? (parseFloat(s.gross) / maxGross) * 100 : 0;
                const color = PLATFORM_COLORS[i % PLATFORM_COLORS.length];
                return (
                  <View key={s.platform} style={{ marginBottom: i < sorted.length - 1 ? 14 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>{s.platform_label}</Text>
                      <Money style={{ fontSize: 13, fontWeight: '700' }}>{fmtMoney(s.gross, currency)}</Money>
                    </View>
                    <View style={{ height: 7, borderRadius: 999, backgroundColor: p.track, overflow: 'hidden' }}>
                      <View style={{ height: 7, borderRadius: 999, backgroundColor: color, width: `${pct}%` }} />
                    </View>
                    <Text style={{ color: p.text3, fontSize: 10.5, marginTop: 4 }}>{fmtNum(s.streams)} streams · {(s.percentage || 0).toFixed(1).replace('.', ',')} %</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
