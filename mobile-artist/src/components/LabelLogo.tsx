import React, { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Logo du label (Whales Records) — récupéré via /artist-portal/label-settings,
 * avec variante sombre, comme l'app web. La largeur épouse le logo (ratio réel
 * mesuré) pour qu'il soit collé à gauche et aligné, sans retrait flottant.
 * Repli sur le nom texte si aucun logo.
 */
export function LabelLogo({ height = 26, maxWidth = 150 }: { height?: number; maxWidth?: number }) {
  const { theme, palette } = useTheme();
  const [ls, setLs] = useState<LabelSettings | null>(null);
  const [ratio, setRatio] = useState<number | null>(null); // largeur / hauteur

  useEffect(() => {
    let cancelled = false;
    getLabelSettings().then((s) => { if (!cancelled) setLs(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const logoLight = ls?.logo_base64 || ls?.logo_url || ls?.label_logo_url;
  const logoDark = ls?.logo_dark_base64;
  const src = theme === 'dark' && logoDark ? logoDark : logoLight || logoDark;

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    Image.getSize(
      src,
      (w, h) => { if (!cancelled && h > 0) setRatio(w / h); },
      () => {},
    );
    return () => { cancelled = true; };
  }, [src]);

  if (src) {
    const width = Math.min(maxWidth, Math.round(height * (ratio ?? 3)));
    return <Image source={{ uri: src }} resizeMode="contain" style={{ height, width }} />;
  }
  return (
    <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }}>
      {ls?.label_name || 'Whales Records'}
    </Text>
  );
}
