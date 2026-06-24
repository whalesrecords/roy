import React from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { ACCENTS } from '@/theme/tokens';
import { useLanguage, Lang } from '@/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { Card, Eyebrow } from '@/components/ui';
import { IconCard, IconSupport, IconLogout, IconChevronRight } from '@/components/icons';

export default function SettingsScreen() {
  const p = usePalette();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { artist, logout } = useAuth();
  const nav = useNavigation<any>();

  const initials = (artist?.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}>
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('settings.title')}</Text>

        {/* Profile */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {artist?.artwork_url ? null : (
              <View style={{ width: 48, height: 48, borderRadius: 999, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.accent, fontWeight: '800', fontSize: 16 }}>{initials}</Text>
              </View>
            )}
            <View>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>{artist?.name}</Text>
              <Text style={{ color: p.text3, fontSize: 12 }}>Artiste · Whales Records</Text>
            </View>
          </View>
        </Card>

        {/* Appearance */}
        <Card>
          <Eyebrow>Apparence</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: p.text, fontSize: 14 }}>{t('common.darkMode')}</Text>
            <Switch value={theme === 'dark'} onValueChange={toggleTheme} trackColor={{ true: p.accent, false: p.track }} />
          </View>
          <View style={{ height: 1, backgroundColor: p.border, marginVertical: 14 }} />
          <Text style={{ color: p.text, fontSize: 14, marginBottom: 10 }}>Couleur d'accent</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {ACCENTS.map((a) => (
              <Pressable key={a.id} onPress={() => setAccent(a.id)} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: a.color, borderWidth: accent === a.id ? 3 : 0, borderColor: p.text }} />
                <Text style={{ color: accent === a.id ? p.text : p.text3, fontSize: 10.5 }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: p.border, marginVertical: 14 }} />
          <Text style={{ color: p.text, fontSize: 14, marginBottom: 10 }}>Langue</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['fr', 'en'] as Lang[]).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: lang === l ? p.accentSoft : p.surface2, borderColor: lang === l ? p.accent : p.border, borderWidth: 1 }}>
                <Text style={{ color: lang === l ? p.accent : p.text2, fontWeight: '600', fontSize: 13 }}>{l === 'fr' ? 'Français' : 'English'}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Links */}
        <Card style={{ padding: 0 }}>
          <LinkRow icon={<IconCard size={18} color={p.text2} />} label={t('payments.title')} onPress={() => nav.navigate('Payments')} pal={p} border />
          <LinkRow icon={<IconSupport size={18} color={p.text2} />} label={t('support.title')} onPress={() => nav.navigate('Support')} pal={p} />
        </Card>

        {/* Logout */}
        <Pressable onPress={logout} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderColor: p.border, borderWidth: 1, backgroundColor: p.surface }}>
          <IconLogout size={17} color={p.neg} />
          <Text style={{ color: p.neg, fontWeight: '700', fontSize: 14 }}>{t('common.logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({ icon, label, onPress, pal, border }: { icon: React.ReactNode; label: string; onPress: () => void; pal: ReturnType<typeof usePalette>; border?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomColor: pal.border, borderBottomWidth: border ? 1 : 0 }}>
      {icon}
      <Text style={{ color: pal.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{label}</Text>
      <IconChevronRight size={16} color={pal.text3} />
    </Pressable>
  );
}
