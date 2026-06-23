import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

/**
 * Root route — bounces the user to the login screen or to the tabs based on
 * the auth state. Avoids flashing the tab bar before auth resolves.
 */
export default function RootIndex() {
  const { user, loading } = useAuth();
  const { tokens } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/auth/login'} />;
}
