import React, { useState } from 'react';
import {
  View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { AccentButton } from '@/components/ui';

type Mode = 'code' | 'email';

export default function LoginScreen() {
  const p = usePalette();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { loginWithCode, loginWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const ok = mode === 'code'
      ? await loginWithCode(code.trim())
      : await loginWithEmail(email.trim(), password);
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ marginBottom: 28 }}>
            <Image
              source={theme === 'dark' ? require('../../assets/logo-light.png') : require('../../assets/logo-dark.png')}
              style={{ width: 168, height: 168 * (581 / 1000) }}
              resizeMode="contain"
            />
          </View>

          <Text style={{ color: p.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{t('login.title')}</Text>
          <Text style={{ color: p.text3, fontSize: 13.5, marginTop: 6 }}>{t('login.subtitle')}</Text>

          {/* Mode switch */}
          <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: 12, padding: 4, marginTop: 24, borderColor: p.border, borderWidth: 1 }}>
            {(['code', 'email'] as Mode[]).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: mode === m ? p.surface : 'transparent', alignItems: 'center' }}>
                <Text style={{ color: mode === m ? p.text : p.text3, fontWeight: '600', fontSize: 13 }}>
                  {m === 'code' ? t('login.byCode') : t('login.byEmail')}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'code' ? (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600' }}>{t('login.code')}</Text>
              <TextInput
                value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false}
                placeholder="XXXX-XXXX" placeholderTextColor={p.text3} style={inputStyle}
              />
            </View>
          ) : (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600' }}>{t('login.email')}</Text>
              <TextInput
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                placeholder="vous@exemple.com" placeholderTextColor={p.text3} style={inputStyle}
              />
              <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600', marginTop: 14 }}>{t('login.password')}</Text>
              <TextInput
                value={password} onChangeText={setPassword} secureTextEntry
                placeholder="••••••••" placeholderTextColor={p.text3} style={inputStyle}
              />
            </View>
          )}

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
