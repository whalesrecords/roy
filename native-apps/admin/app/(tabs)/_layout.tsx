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
        options={{
          title: 'Bord',
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="royalties"
        options={{
          title: 'Royalties',
          tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="artists"
        options={{
          title: 'Artistes',
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
