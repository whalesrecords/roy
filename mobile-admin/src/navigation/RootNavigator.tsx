import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme, usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Loader, TopProgressBar } from '@/components/ui';
import { IconHome, IconUsers, IconCoins, IconMegaphone, IconGrid, IconProps } from '@/components/icons';
import LoginScreen from '@/screens/LoginScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import ArtistsScreen from '@/screens/ArtistsScreen';
import ArtistDetailScreen from '@/screens/ArtistDetailScreen';
import RoyaltiesScreen from '@/screens/RoyaltiesScreen';
import RunDetailScreen from '@/screens/RunDetailScreen';
import PromoScreen from '@/screens/PromoScreen';
import MoreScreen from '@/screens/MoreScreen';
import ContractsScreen from '@/screens/ContractsScreen';
import ContractDetailScreen from '@/screens/ContractDetailScreen';
import ContractFormScreen from '@/screens/ContractFormScreen';
import FinancesScreen from '@/screens/FinancesScreen';
import ExpenseFormScreen from '@/screens/ExpenseFormScreen';
import InventoryScreen from '@/screens/InventoryScreen';
import ProductFormScreen from '@/screens/ProductFormScreen';
import SupportScreen from '@/screens/SupportScreen';
import TicketDetailScreen from '@/screens/TicketDetailScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import CatalogScreen from '@/screens/CatalogScreen';
import CatalogArtistScreen from '@/screens/CatalogArtistScreen';
import ReleaseTracksScreen from '@/screens/ReleaseTracksScreen';
import ImportsScreen from '@/screens/ImportsScreen';
import SpotifySuggestionsScreen from '@/screens/SpotifySuggestionsScreen';

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
      <Tab.Screen name="Artists" component={ArtistsScreen} options={{ title: t('nav.artists'), tabBarIcon: icon(IconUsers) }} />
      <Tab.Screen name="Royalties" component={RoyaltiesScreen} options={{ title: t('nav.royalties'), tabBarIcon: icon(IconCoins) }} />
      <Tab.Screen name="Promo" component={PromoScreen} options={{ title: t('nav.promo'), tabBarIcon: icon(IconMegaphone) }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ title: t('nav.more'), tabBarIcon: icon(IconGrid) }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
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
            {user ? (
              <>
                <Stack.Screen name="Tabs" component={Tabs} />
                <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} options={{ ...headerOpts, title: 'Artiste' }} />
                <Stack.Screen name="Contracts" component={ContractsScreen} options={headerOpts} />
                <Stack.Screen name="ContractDetail" component={ContractDetailScreen} options={headerOpts} />
                <Stack.Screen name="ContractForm" component={ContractFormScreen} options={headerOpts} />
                <Stack.Screen name="RunDetail" component={RunDetailScreen} options={headerOpts} />
                <Stack.Screen name="Finances" component={FinancesScreen} options={headerOpts} />
                <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={headerOpts} />
                <Stack.Screen name="Inventory" component={InventoryScreen} options={headerOpts} />
                <Stack.Screen name="ProductForm" component={ProductFormScreen} options={headerOpts} />
                <Stack.Screen name="Support" component={SupportScreen} options={headerOpts} />
                <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={headerOpts} />
                <Stack.Screen name="Catalog" component={CatalogScreen} options={headerOpts} />
                <Stack.Screen name="CatalogArtist" component={CatalogArtistScreen} options={headerOpts} />
                <Stack.Screen name="ReleaseTracks" component={ReleaseTracksScreen} options={headerOpts} />
                <Stack.Screen name="Imports" component={ImportsScreen} options={headerOpts} />
                <Stack.Screen name="SpotifySuggestions" component={SpotifySuggestionsScreen} options={headerOpts} />
                <Stack.Screen name="Settings" component={SettingsScreen} options={headerOpts} />
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
