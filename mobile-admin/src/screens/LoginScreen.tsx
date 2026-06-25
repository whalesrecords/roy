import React, { useState } from 'react';
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { AccentButton } from '@/components/ui';

export default function LoginScreen() {
  const p = usePalette();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const ok = await login(email, password);
    if (!ok) setError(t('login.error'));
    setBusy(false);
  };

  const inputStyle = {
    backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, color: p.text, fontSize: 15, marginTop: 8,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 460, width: '100%', alignSelf: 'center' }}>
          <View style={{ marginBottom: 28 }}>
            <Image
              source={theme === 'dark' ? require('../../assets/logo-light.png') : require('../../assets/logo-dark.png')}
              style={{ width: 168, height: 168 * (581 / 1000) }}
              resizeMode="contain"
            />
          </View>

          <Text style={{ color: p.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{t('login.title')}</Text>
          <Text style={{ color: p.text3, fontSize: 13.5, marginTop: 6 }}>{t('login.subtitle')}</Text>

          <View style={{ marginTop: 24 }}>
            <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600' }}>{t('login.email')}</Text>
            <TextInput
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
              placeholder="vous@whalesrecords.com" placeholderTextColor={p.text3} style={inputStyle}
            />
            <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600', marginTop: 14 }}>{t('login.password')}</Text>
            <TextInput
              value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit}
              placeholder="••••••••" placeholderTextColor={p.text3} style={inputStyle}
            />
          </View>

          {error ? (
            <View style={{ backgroundColor: 'rgba(220,76,87,0.1)', borderColor: 'rgba(220,76,87,0.2)', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 }}>
              <Text style={{ color: p.neg, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 22 }}>
            <AccentButton label={t('login.submit')} onClick={submit} loading={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
