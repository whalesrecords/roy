import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card } from '@/components/ui';
import { Screen, Divider } from '@/components/kit';
import {
  IconWallet, IconBox, IconSupport, IconSettings, IconFile, IconLayers, IconArrowDown, IconSpotify, IconChevronRight, IconProps,
} from '@/components/icons';

export default function MoreScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();

  const items: { key: string; label: string; icon: (pr: IconProps) => React.JSX.Element; route: string }[] = [
    { key: 'catalogue', label: t('more.catalogue'), icon: IconLayers, route: 'Catalog' },
    { key: 'contracts', label: t('more.contracts'), icon: IconFile, route: 'Contracts' },
    { key: 'finances', label: t('more.finances'), icon: IconWallet, route: 'Finances' },
    { key: 'inventory', label: t('more.inventory'), icon: IconBox, route: 'Inventory' },
    { key: 'imports', label: t('more.imports'), icon: IconArrowDown, route: 'Imports' },
    { key: 'spotify', label: t('more.spotify'), icon: IconSpotify, route: 'SpotifySuggestions' },
    { key: 'support', label: t('more.support'), icon: IconSupport, route: 'Support' },
    { key: 'settings', label: t('more.settings'), icon: IconSettings, route: 'Settings' },
  ];

  return (
    <Screen title={t('more.title')}>
      <Card style={{ paddingVertical: 4 }}>
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <View key={it.key}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => nav.navigate(it.route)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={19} color={p.accent} />
                </View>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{it.label}</Text>
                <IconChevronRight size={18} color={p.text3} />
              </Pressable>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
