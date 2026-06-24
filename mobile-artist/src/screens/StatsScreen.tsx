import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getPlatformStats, getQuarterlyRevenue, getAvailableYears, getArtistTracks, invalidateCache,
  PlatformStats, QuarterlyRevenue, ArtistTrack,
} from '@/lib/api';
import { Card, Eyebrow, Money, Loader } from '@/components/ui';
import { fmtMoney, fmtNum } from '@/lib/format';

type ViewKey = 'plateformes' | 'titres' | 'periodes';
type PeriodMode = 'trimestre' | 'annee';

interface BarItem { key: string; label: string; value: number; sub?: string }

function Segmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: 12, padding: 4, borderColor: p.border, borderWidth: 1 }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: value === o.key ? p.surface : 'transparent', alignItems: 'center' }}>
          <Text style={{ color: value === o.key ? p.text : p.text3, fontWeight: '600', fontSize: 12.5 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function BarList({ items, currency }: { items: BarItem[]; currency: string }) {
  const p = usePalette();
  const max = items.reduce((m, x) => Math.max(m, x.value), 0) || 1;
  if (items.length === 0) {
    return <Text style={{ color: p.text3, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>Aucune donnée</Text>;
  }
  return (
    <View style={{ gap: 14 }}>
      {items.map((it) => (
        <View key={it.key}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
            <Text style={{ color: p.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{it.label}</Text>
            <Money style={{ fontSize: 13, fontWeight: '700' }}>{fmtMoney(it.value, currency)}</Money>
          </View>
          <View style={{ height: 7, borderRadius: 999, backgroundColor: p.track, overflow: 'hidden' }}>
            <View style={{ height: 7, borderRadius: 999, backgroundColor: p.accent, width: `${Math.round((it.value / max) * 100)}%` }} />
          </View>
          {it.sub ? <Text style={{ color: p.text3, fontSize: 10.5, marginTop: 4 }}>{it.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(0);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [quarterly, setQuarterly] = useState<QuarterlyRevenue[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [yearTotals, setYearTotals] = useState<{ year: number; gross: number; streams: number }[]>([]);
  const [view, setView] = useState<ViewKey>('plateformes');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('trimestre');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadYears = useCallback(async () => {
    const d = await getAvailableYears();
    const ys = d.years.length ? d.years : [new Date().getFullYear()];
    setYears(ys);
    setYear((y) => (y === 0 ? d.default_year || ys[0] : y));
  }, []);

  const loadForYear = useCallback(async (yr: number) => {
    const [pf, q] = await Promise.all([getPlatformStats(yr), getQuarterlyRevenue(yr)]);
    setPlatforms(pf);
    setQuarterly(q.filter((x) => parseFloat(x.gross) > 0 || x.streams > 0));
  }, []);

  useEffect(() => { loadYears(); getArtistTracks().then(setTracks).catch(() => {}); }, [loadYears]);
  useEffect(() => {
    if (year === 0) return;
    let cancelled = false;
    (async () => { setLoading(true); try { await loadForYear(year); } catch { /* */ } finally { if (!cancelled) setLoading(false); } })();
    return () => { cancelled = true; };
  }, [year, loadForYear]);

  // Lazy: totaux par année (quand la vue Année est ouverte)
  useEffect(() => {
    if (!(view === 'periodes' && periodMode === 'annee') || years.length === 0 || yearTotals.length > 0) return;
    (async () => {
      const res = await Promise.all(years.map(async (y) => {
        try {
          const q = await getQuarterlyRevenue(y);
          return { year: y, gross: q.reduce((s, x) => s + parseFloat(x.gross), 0), streams: q.reduce((s, x) => s + x.streams, 0) };
        } catch { return { year: y, gross: 0, streams: 0 }; }
      }));
      setYearTotals(res.sort((a, b) => b.year - a.year));
    })();
  }, [view, periodMode, years, yearTotals.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateCache('/artist-portal');
    try {
      await loadForYear(year);
      const tr = await getArtistTracks(); setTracks(tr);
      setYearTotals([]);
    } finally { setRefreshing(false); }
  };

  const currency = quarterly[0]?.currency || 'EUR';
  const totalGross = platforms.reduce((s, x) => s + parseFloat(x.gross), 0);
  const totalStreams = platforms.reduce((s, x) => s + x.streams, 0);
  const totalNet = quarterly.reduce((s, x) => s + parseFloat(x.net), 0);

  const platformItems: BarItem[] = [...platforms]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .map((s) => ({ key: s.platform, label: s.platform_label, value: parseFloat(s.gross), sub: `${fmtNum(s.streams)} streams · ${(s.percentage || 0).toFixed(1).replace('.', ',')} %` }));

  const trackItems: BarItem[] = [...tracks]
    .sort((a, b) => parseFloat(b.gross) - parseFloat(a.gross))
    .slice(0, 25)
    .map((tr) => ({ key: tr.isrc || tr.title, label: tr.title, value: parseFloat(tr.gross), sub: `${tr.release_title || 'Single'} · ${fmtNum(tr.streams)} streams` }));

  const quarterItems: BarItem[] = quarterly.map((q) => ({ key: q.quarter, label: `${q.quarter} ${year}`, value: parseFloat(q.gross), sub: `${fmtNum(q.streams)} streams` }));
  const yearItems: BarItem[] = yearTotals.map((y) => ({ key: String(y.year), label: String(y.year), value: y.gross, sub: `${fmtNum(y.streams)} streams` }));

  const showYearSelector = view === 'plateformes' || (view === 'periodes' && periodMode === 'trimestre');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('stats.title')}</Text>

        {/* KPI année sélectionnée */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}><Eyebrow>Brut {year || ''}</Eyebrow><Money style={{ fontSize: 18, fontWeight: '800', marginTop: 6 }}>{fmtMoney(totalGross, currency)}</Money></Card>
          <Card style={{ flex: 1 }}><Eyebrow>Net</Eyebrow><Money style={{ fontSize: 18, fontWeight: '800', marginTop: 6 }}>{fmtMoney(totalNet, currency)}</Money></Card>
          <Card style={{ flex: 1 }}><Eyebrow>Streams</Eyebrow><Money style={{ fontSize: 18, fontWeight: '800', marginTop: 6 }}>{fmtNum(totalStreams)}</Money></Card>
        </View>

        {/* Vues */}
        <Segmented<ViewKey>
          options={[{ key: 'plateformes', label: 'Plateformes' }, { key: 'titres', label: 'Titres' }, { key: 'periodes', label: 'Périodes' }]}
          value={view}
          onChange={setView}
        />

        {/* Sélecteur d'année */}
        {showYearSelector && years.length > 0 ? (
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

        {/* Sous-toggle période */}
        {view === 'periodes' ? (
          <Segmented<PeriodMode>
            options={[{ key: 'trimestre', label: 'Trimestres' }, { key: 'annee', label: 'Années' }]}
            value={periodMode}
            onChange={setPeriodMode}
          />
        ) : null}

        {loading && view !== 'titres' ? <Loader /> : (
          <Card>
            {view === 'plateformes' ? <BarList items={platformItems} currency={currency} /> : null}
            {view === 'titres' ? <BarList items={trackItems} currency={currency} /> : null}
            {view === 'periodes' && periodMode === 'trimestre' ? <BarList items={quarterItems} currency={currency} /> : null}
            {view === 'periodes' && periodMode === 'annee' ? <BarList items={yearItems} currency={currency} /> : null}
          </Card>
        )}

        {view === 'titres' ? (
          <Text style={{ color: p.text3, fontSize: 10.5, textAlign: 'center' }}>Top titres, tous revenus confondus</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
