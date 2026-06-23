import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

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
