import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme, usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Loader, TopProgressBar } from '@/components/ui';
import { IconHome, IconChart, IconMusic, IconFile, IconMegaphone, IconProps } from '@/components/icons';
import LoginScreen from '@/screens/LoginScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import MusicScreen from '@/screens/MusicScreen';
import StatsScreen from '@/screens/StatsScreen';
import StatementsScreen from '@/screens/StatementsScreen';
import PromoScreen from '@/screens/PromoScreen';
import PaymentsScreen from '@/screens/PaymentsScreen';
import SupportScreen from '@/screens/SupportScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const p = usePalette();
  const { t } = useLanguage();
  const icon = (Icon: (props: IconProps) => React.JSX.Element) =>
    ({ color, size }: { color: string; size: number }) => <Icon size={size} color={color} />;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.text3,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: t('nav.home'), tabBarIcon: icon(IconHome) }} />
      <Tab.Screen name="Music" component={MusicScreen} options={{ title: t('nav.music'), tabBarIcon: icon(IconMusic) }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: t('stats.title'), tabBarIcon: icon(IconChart) }} />
      <Tab.Screen name="Statements" component={StatementsScreen} options={{ title: t('statements.title'), tabBarIcon: icon(IconFile) }} />
      <Tab.Screen name="Promo" component={PromoScreen} options={{ title: t('nav.promo'), tabBarIcon: icon(IconMegaphone) }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { artist, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const p = usePalette();

  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: p.bg, card: p.surface, text: p.text, border: p.border, primary: p.accent },
  };

  const headerOpts = {
    headerShown: true,
    headerStyle: { backgroundColor: p.surface },
    headerTitleStyle: { color: p.text },
    headerTintColor: p.accent,
    contentStyle: { backgroundColor: p.bg },
  } as const;

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, backgroundColor: p.bg }}><Loader /></View>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
            {artist ? (
              <>
                <Stack.Screen name="Tabs" component={Tabs} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...headerOpts, title: t('settings.title') }} />
                <Stack.Screen name="Payments" component={PaymentsScreen} options={{ ...headerOpts, title: t('payments.title') }} />
                <Stack.Screen name="Support" component={SupportScreen} options={{ ...headerOpts, title: t('support.title') }} />
              </>
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </Stack.Navigator>
        )}
        <TopProgressBar />
      </View>
    </NavigationContainer>
  );
}
