import React, { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Logo du label (Whales Records) — récupéré via /artist-portal/label-settings,
 * avec variante sombre, exactement comme l'app web. Repli sur le nom texte.
 */
export function LabelLogo({ height = 24, maxWidth = 150 }: { height?: number; maxWidth?: number }) {
  const { theme, palette } = useTheme();
  const [ls, setLs] = useState<LabelSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLabelSettings().then((s) => { if (!cancelled) setLs(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const logoLight = ls?.logo_base64 || ls?.logo_url || ls?.label_logo_url;
  const logoDark = ls?.logo_dark_base64;
  const src = theme === 'dark' && logoDark ? logoDark : logoLight || logoDark;

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        resizeMode="contain"
        style={{ height, width: maxWidth, alignSelf: 'flex-start' }}
      />
    );
  }
  return (
    <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }}>
      {ls?.label_name || 'Whales Records'}
    </Text>
  );
}
