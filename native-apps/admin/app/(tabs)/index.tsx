import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { Eyebrow } from '../../components/Eyebrow';
import { Kpi } from '../../components/Kpi';
import { Pill } from '../../components/Pill';
import { useAuth } from '../../lib/AuthContext';
import { getAnalyticsSummary, getArtistsSummary, getRoyaltyRuns } from '../../lib/api';
import { fmtEUR, initials } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

export default function DashboardScreen() {
  const { tokens } = useTheme();
  const { signOut } = useAuth();
  const year = new Date().getFullYear();

  const analytics = useQuery({ queryKey: ['analytics', year], queryFn: () => getAnalyticsSummary(year) });
  const artists = useQuery({ queryKey: ['artists-summary'], queryFn: getArtistsSummary });
  const runs = useQuery({ queryKey: ['royalty-runs'], queryFn: getRoyaltyRuns });

  const loading = analytics.isLoading || artists.isLoading || runs.isLoading;

  const topArtists = (artists.data || [])
    .slice()
    .sort((a, b) => parseFloat(b.total_gross) - parseFloat(a.total_gross))
    .slice(0, 3);

  const draft = (runs.data || []).find((r) => !r.is_locked);
  const royaltiesDue = draft ? parseFloat(draft.total_net_payable) : 0;

  const netLabel = analytics.data ? parseFloat(analytics.data.net) : 0;
  const totalRevenue = analytics.data ? parseFloat(analytics.data.total_revenue) : 0;
  const totalExpenses = analytics.data ? parseFloat(analytics.data.total_expenses) : 0;
  const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 18 }}>
          <View>
            <Text style={{ color: tokens.text3, fontSize: 12 }}>Whales Records</Text>
            <Text style={{ ...tokens.type.h1, color: tokens.text, marginTop: 2 }}>Tableau de bord</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onTouchEnd={signOut}
          >
            <Text style={{ color: tokens.text2, fontWeight: '700', fontSize: 12 }}>LM</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <>
            {/* Hero — Net label */}
            <Card hero style={{ overflow: 'hidden', padding: 24 }}>
              <View
                style={{
                  position: 'absolute',
                  top: -50,
                  right: -40,
                  width: 170,
                  height: 170,
                  borderRadius: 999,
                  backgroundColor: tokens.accentSoft,
                  opacity: 0.55,
                }}
              />
              <Eyebrow>{`Net label · ${year}`}</Eyebrow>
              <Text
                style={{
                  ...tokens.type.heroNum,
                  color: tokens.text,
                  marginTop: 8,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {fmtEUR(netLabel)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
                <View>
                  <Text style={{ color: tokens.text3, fontSize: 11 }}>Revenus</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {fmtEUR(totalRevenue)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: tokens.border }} />
                <View>
                  <Text style={{ color: tokens.text3, fontSize: 11 }}>Dépenses</Text>
                  <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {fmtEUR(totalExpenses)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* KPI grid */}
            <View style={{ flexDirection: 'row', gap: 11, marginTop: 11 }}>
              <Kpi label="Royalties dues" value={fmtEUR(royaltiesDue)} hint={`${draft?.artists.length ?? 0} artistes`} />
              <Kpi label="Marge nette" value={`${margin.toFixed(1).replace('.', ',')} %`} accent />
            </View>

            {/* Top artists */}
            {topArtists.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                  <Text style={{ color: tokens.text, fontSize: 14, fontWeight: '600' }}>Top artistes</Text>
                  <Pill tone="accent">{`${topArtists.length} top`}</Pill>
                </View>
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {topArtists.map((a, i) => (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 13,
                        borderBottomWidth: i < topArtists.length - 1 ? 1 : 0,
                        borderBottomColor: tokens.border,
                      }}
                    >
                      <Text style={{ fontFamily: 'monospace', color: tokens.text3, fontSize: 11, width: 12 }}>{i + 1}</Text>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          backgroundColor: i === 0 ? tokens.accentSoft : tokens.surface2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: i === 0 ? tokens.accent : tokens.text2, fontWeight: '700', fontSize: 11 }}>
                          {initials(a.name)}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, color: tokens.text, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>
                        {a.name}
                      </Text>
                      <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                        {fmtEUR(a.total_gross)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
