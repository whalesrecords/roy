import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { Eyebrow } from '../../components/Eyebrow';
import { Kpi } from '../../components/Kpi';
import { useAuth } from '../../lib/AuthContext';
import { getArtistDashboard } from '../../lib/api';
import { fmtEUR, fmtMillions, initials } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

export default function ArtistHomeScreen() {
  const { tokens } = useTheme();
  const { signOut } = useAuth();
  const dashboard = useQuery({ queryKey: ['artist-dashboard'], queryFn: getArtistDashboard });

  const data = dashboard.data;
  const artistName = data?.artist.name || 'Artiste';
  const firstName = artistName.split(' ')[0];
  const available = data ? parseFloat(data.advance_balance) : 0;
  const totalNet = data ? parseFloat(data.total_net) : 0;
  const totalStreams = data?.total_streams ?? 0;
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: tokens.text3, fontSize: 12, textTransform: 'capitalize' }}>{today}</Text>
            <Text style={{ ...tokens.type.h1, color: tokens.text, marginTop: 2 }}>Bonjour, {firstName}</Text>
          </View>
          <Pressable
            onPress={signOut}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: tokens.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tokens.accent, fontWeight: '700', fontSize: 13 }}>{initials(artistName)}</Text>
          </Pressable>
        </View>

        {dashboard.isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <>
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
              <Eyebrow>Disponible au versement</Eyebrow>
              <Text style={{ ...tokens.type.heroNum, color: tokens.text, marginTop: 8, fontVariant: ['tabular-nums'] }}>
                {fmtEUR(available)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 }}>
                <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: tokens.accent }} />
                <Text style={{ color: tokens.text2, fontSize: 12.5 }}>
                  <Text style={{ color: tokens.text, fontWeight: '600' }}>Solde recoupable</Text>
                </Text>
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: 11, marginTop: 11 }}>
              <Kpi label="Cumul net" value={fmtEUR(totalNet)} />
              <Kpi label="Streams" value={fmtMillions(totalStreams)} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
