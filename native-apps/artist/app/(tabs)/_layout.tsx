import { Feather } from '@expo/vector-icons';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

export default function TabsLayout() {
  const { tokens } = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }
  if (!user) return <Redirect href="/auth/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.accent,
        tabBarInactiveTintColor: tokens.text3,
        tabBarStyle: {
          backgroundColor: tokens.nav,
          borderTopColor: tokens.border,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 8,
          paddingBottom: 22,
        },
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="musique"
        options={{ title: 'Musique', tabBarIcon: ({ color }) => <Feather name="music" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="releves"
        options={{ title: 'Relevés', tabBarIcon: ({ color }) => <Feather name="file-text" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: 'Profil', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
