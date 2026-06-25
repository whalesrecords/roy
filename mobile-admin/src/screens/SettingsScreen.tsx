import React from 'react';
import { View, Text, Switch, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { useLanguage, Lang } from '@/i18n';
import { ACCENTS } from '@/theme/tokens';
import { useAuth } from '@/auth/AuthProvider';
import { Card, Eyebrow } from '@/components/ui';
import { State, SectionTitle, Divider } from '@/components/kit';
import { IconLogout } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getLabelSettings } from '@/lib/api';

export default function SettingsScreen() {
  const p = usePalette();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { user, logout } = useAuth();
  const nav = useNavigation<any>();
  const labelQ = useFetch(getLabelSettings, [], 'label');

  React.useEffect(() => { nav.setOptions?.({ title: t('settings.title') }); }, [nav, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        <Card>
          <SectionTitle>{t('settings.appearance')}</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '600' }}>{t('settings.darkMode')}</Text>
            <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ true: p.accent }} thumbColor="#fff" />
          </View>
          <Divider />
          <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600', marginTop: 12 }}>{t('settings.accent')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {ACCENTS.map((a) => (
              <Pressable key={a.id} onPress={() => setAccent(a.id)} style={{ alignItems: 'center', gap: 5 }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 19, backgroundColor: a.color,
                  borderWidth: accent === a.id ? 3 : 0, borderColor: p.text,
                }} />
                <Text style={{ color: accent === a.id ? p.text : p.text3, fontSize: 11, fontWeight: '600' }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle>{t('settings.language')}</SectionTitle>
          <View style={{ flexDirection: 'row', backgroundColor: p.surface2, borderRadius: 12, padding: 4, marginTop: 10, borderColor: p.border, borderWidth: 1 }}>
            {(['fr', 'en'] as Lang[]).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: lang === l ? p.surface : 'transparent', alignItems: 'center' }}>
                <Text style={{ color: lang === l ? p.text : p.text3, fontWeight: '700', fontSize: 13 }}>{l === 'fr' ? 'Français' : 'English'}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle>{t('settings.label')}</SectionTitle>
          <State loading={labelQ.loading} error={labelQ.error} onRetry={labelQ.reload}>
            {labelQ.data ? (
              <View style={{ marginTop: 8, gap: 5 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{labelQ.data.label_name || 'Whales Records'}</Text>
                {labelQ.data.email ? <Text style={{ color: p.text2, fontSize: 12.5 }}>{labelQ.data.email}</Text> : null}
                {labelQ.data.website ? <Text style={{ color: p.text2, fontSize: 12.5 }}>{labelQ.data.website}</Text> : null}
                {labelQ.data.vat_number ? <Text style={{ color: p.text3, fontSize: 12 }}>TVA · {labelQ.data.vat_number}</Text> : null}
              </View>
            ) : null}
          </State>
        </Card>

        <Card>
          <Eyebrow>{t('settings.account')}</Eyebrow>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '600', marginTop: 6 }}>{user?.email || '—'}</Text>
          <Pressable
            onPress={logout}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(220,76,87,0.1)', borderRadius: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <IconLogout size={18} color={p.neg} />
            <Text style={{ color: p.neg, fontWeight: '700', fontSize: 14 }}>{t('settings.logout')}</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
