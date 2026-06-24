import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthProvider';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getArtistDashboard, getStatements, getArtistTracks, getQuarterlyRevenue, getArtistPayments,
  getAvailableYears, getMembersBreakdown, requestPayment, invalidateCache,
  ArtistDashboard, Statement, ArtistTrack, ArtistPayment, MembersBreakdown,
} from '@/lib/api';
import { Card, Eyebrow, Money, AccentButton, Sparkline, Cover, Loader, Avatar } from '@/components/ui';
import { LabelLogo } from '@/components/LabelLogo';
import { IconInflow, IconOutflow, IconArrowDown } from '@/components/icons';
import { fmtMoney, fmtNum, fmtDateShort } from '@/lib/format';

interface Activity { id: string; label: string; sub: string; amount: number; inflow: boolean; date: number }

export default function DashboardScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const { artist } = useAuth();

  const [data, setData] = useState<ArtistDashboard | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [quarterly, setQuarterly] = useState<number[]>([]);
  const [payments, setPayments] = useState<ArtistPayment[]>([]);
  const [breakdown, setBreakdown] = useState<MembersBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadPrimary = useCallback(async () => {
    const [dash, stmts] = await Promise.all([getArtistDashboard(), getStatements()]);
    setData(dash);
    setStatements(stmts);
  }, []);

  const loadSecondary = useCallback(async () => {
    try {
      const [years, tr, pay] = await Promise.all([getAvailableYears(), getArtistTracks(), getArtistPayments()]);
      const q = years.default_year ? await getQuarterlyRevenue(years.default_year) : [];
      setQuarterly(q.map((x) => parseFloat(x.gross)).filter((x) => x > 0));
      setTracks(tr);
      setPayments(pay);
    } catch { /* non-critique */ }
    try {
      const b = await getMembersBreakdown();
      if (b.is_group) setBreakdown(b);
    } catch { /* non-critique */ }
  }, []);

  useEffect(() => {
    (async () => {
      try { await loadPrimary(); } finally { setLoading(false); }
      loadSecondary();
    })();
  }, [loadPrimary, loadSecondary]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateCache('/artist-portal');
    try { await loadPrimary(); await loadSecondary(); } finally { setRefreshing(false); }
  };

  const currency = data?.currency || 'EUR';
  const unpaid = statements.filter((s) => s.status !== 'paid');
  const available = unpaid
    .filter((s) => ['approved', 'ready', 'pending_payment'].includes(s.status))
    .reduce((sum, s) => sum + parseFloat(s.net_payable), 0);
  const totalUnpaid = unpaid.reduce((sum, s) => sum + parseFloat(s.net_payable), 0);
  const pendingValidation = Math.max(totalUnpaid - available, 0);
  const displayAvailable = available || totalUnpaid;

  const handleRequest = async () => {
    if (!unpaid.length) return;
    setRequesting(true);
    try {
      await requestPayment(unpaid[0].id);
      setToast('Demande de versement envoyée !');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setRequesting(false);
    }
  };

  const activity: Activity[] = [
    ...statements.slice(0, 5).map((s) => ({
      id: `s-${s.id}`, label: `Relevé · ${s.period_label}`,
      sub: `Royalties · ${fmtDateShort(s.created_at)}`, amount: parseFloat(s.net_payable), inflow: true,
      date: new Date(s.created_at).getTime(),
    })),
    ...payments.slice(0, 5).map((pm) => ({
      id: `p-${pm.id}`, label: pm.description || 'Versement SEPA',
      sub: `Virement · ${fmtDateShort(pm.date)}`, amount: parseFloat(pm.amount), inflow: false,
      date: new Date(pm.date).getTime(),
    })),
  ].sort((a, b) => b.date - a.date).slice(0, 5);

  const topTracks = [...tracks].sort((a, b) => b.streams - a.streams).slice(0, 3);
  const firstName = artist?.name?.split(' ')[0] || '';
  const nav = useNavigation<any>();

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        {/* Top bar : logo Whales Records + avatar artiste */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <LabelLogo height={24} />
          <Pressable onPress={() => nav.navigate('Settings')}>
            <Avatar name={artist?.name} uri={artist?.artwork_url} size={40} />
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ marginBottom: 2 }}>
          <Text style={{ color: p.text3, fontSize: 12 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>Bonjour, {firstName}</Text>
        </View>

        {toast ? (
          <View style={{ backgroundColor: p.accentSoft, borderColor: p.accent, borderWidth: 1, borderRadius: 14, padding: 12 }}>
            <Text style={{ color: p.accent, fontSize: 13 }}>{toast}</Text>
          </View>
        ) : null}

        {/* Hero */}
        <Card hero>
          <Eyebrow>{t('common.available')}</Eyebrow>
          <Money style={{ fontSize: 42, fontWeight: '800', marginTop: 8 }}>{fmtMoney(displayAvailable, currency)}</Money>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: p.accent }} />
            <Text style={{ color: p.text2, fontSize: 12.5 }}>
              <Text style={{ color: p.text, fontWeight: '700' }}>+ {fmtMoney(pendingValidation, currency)}</Text> {t('common.pendingValidation')}
            </Text>
          </View>
          {quarterly.length > 1 ? <View style={{ marginTop: 14 }}><Sparkline points={quarterly} width={300} height={34} /></View> : null}
          {totalUnpaid > 0 ? (
            <View style={{ marginTop: 16 }}>
              <AccentButton label={t('common.requestPayment')} onClick={handleRequest} loading={requesting} icon={<IconArrowDown size={15} color={p.accentInk} />} />
            </View>
          ) : null}
        </Card>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Eyebrow>{t('common.netCumulative')}</Eyebrow>
            <Money style={{ fontSize: 21, fontWeight: '800', marginTop: 6 }}>{fmtMoney(data?.total_net ?? 0, currency)}</Money>
          </Card>
          <Card style={{ flex: 1 }}>
            <Eyebrow>{t('common.grossRevenue')}</Eyebrow>
            <Money style={{ fontSize: 21, fontWeight: '800', marginTop: 6 }}>{fmtMoney(data?.total_gross ?? 0, currency)}</Money>
            <Text style={{ color: p.text3, fontSize: 11, marginTop: 4 }}>{fmtNum(data?.total_streams ?? 0)} {t('common.streams')}</Text>
          </Card>
        </View>

        {/* Activity */}
        <Card style={{ padding: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomColor: p.border, borderBottomWidth: 1 }}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>{t('common.recentActivity')}</Text>
          </View>
          {activity.length === 0 ? (
            <Text style={{ color: p.text3, fontSize: 13, textAlign: 'center', paddingVertical: 28 }}>{t('common.noActivity')}</Text>
          ) : activity.map((a, i) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomColor: p.border, borderBottomWidth: i < activity.length - 1 ? 1 : 0 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: a.inflow ? p.accentSoft : p.surface2 }}>
                {a.inflow ? <IconInflow size={18} color={p.accent} /> : <IconOutflow size={18} color={p.text2} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{a.label}</Text>
                <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{a.sub}</Text>
              </View>
              <Money style={{ fontSize: 14, fontWeight: '700', color: a.inflow ? p.accent : p.text2 }}>
                {a.inflow ? '+' : '−'} {fmtMoney(Math.abs(a.amount), currency)}
              </Money>
            </View>
          ))}
        </Card>

        {/* Top tracks */}
        <Card>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700', marginBottom: 14 }}>{t('common.topTracks')}</Text>
          {topTracks.length === 0 ? (
            <Text style={{ color: p.text3, fontSize: 13 }}>{t('common.noTrack')}</Text>
          ) : topTracks.map((tr, i) => (
            <View key={tr.isrc} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: i === 0 ? 0 : 14 }}>
              <Text style={{ color: p.text3, fontSize: 12, width: 12 }}>{i + 1}</Text>
              <Cover size={36} radius={9} uri={tr.artwork_url} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{tr.title}</Text>
                <Text style={{ color: p.text3, fontSize: 11 }} numberOfLines={1}>{tr.release_title || 'Single'}</Text>
              </View>
              <Money style={{ fontSize: 12.5, color: p.text2 }}>{fmtNum(tr.streams)}</Money>
            </View>
          ))}
        </Card>

        {/* Members breakdown (group) */}
        {breakdown && breakdown.members.length > 0 ? (
          <Card style={{ padding: 0 }}>
            <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomColor: p.border, borderBottomWidth: 1 }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>{t('common.membersBreakdown')}</Text>
              <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>Selon les parts du contrat · {breakdown.members.length} membres</Text>
            </View>
            {breakdown.members.map((m, i) => (
              <View key={m.artist_id || m.name} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomColor: p.border, borderBottomWidth: i < breakdown.members.length - 1 ? 1 : 0 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>{m.name}</Text>
                  <Text style={{ color: p.text3, fontSize: 11 }}>{(m.share_pct).toFixed(1).replace('.', ',')} %</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Money style={{ fontSize: 13, fontWeight: '700' }}>{fmtMoney(m.net, breakdown.currency)}</Money>
                  <Text style={{ color: p.accent, fontSize: 11, fontWeight: '600' }}>{fmtMoney(m.available, breakdown.currency)} dispo</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
