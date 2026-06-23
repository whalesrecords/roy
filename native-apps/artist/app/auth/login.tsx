import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

export default function LoginScreen() {
  const { tokens } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}
      >
        <View style={{ marginBottom: 32 }}>
          <Text style={{ ...tokens.type.eyebrow, color: tokens.text3 }}>WHALES RECORDS</Text>
          <Text style={{ ...tokens.type.h1, color: tokens.text, marginTop: 6 }}>Connexion admin</Text>
          <Text style={{ color: tokens.text2, fontSize: 13.5, marginTop: 6, lineHeight: 19 }}>
            Accède au tableau de bord, aux royalties et aux finances de ton label.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Field
            icon="mail"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field icon="lock" placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        {error ? (
          <Text style={{ color: tokens.neg, fontSize: 12.5, marginTop: 14 }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: 22,
            backgroundColor: tokens.accent,
            paddingVertical: 15,
            borderRadius: tokens.radius.button,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={tokens.accentInk} />
          ) : (
            <Text style={{ color: tokens.accentInk, fontWeight: '700', fontSize: 14 }}>Se connecter</Text>
          )}
        </Pressable>

        <Text style={{ color: tokens.text3, fontSize: 11, marginTop: 18, textAlign: 'center' }}>
          Backend : {process.env.EXPO_PUBLIC_API_URL || 'api.whalesrecords.com'}
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: {
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: tokens.surface,
        borderColor: tokens.border,
        borderWidth: 1,
        borderRadius: tokens.radius.button,
        paddingHorizontal: 14,
      }}
    >
      <Feather name={props.icon} size={16} color={tokens.text3} />
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={tokens.text3}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize={props.autoCapitalize ?? 'sentences'}
        style={{ flex: 1, color: tokens.text, fontSize: 14, paddingVertical: 14 }}
      />
    </View>
  );
}
