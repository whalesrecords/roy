import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { getLabelSettings, LabelSettings } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

// Logo Whales embarqué (recoloré) — repli fiable, sans dépendance API.
const BUNDLED_DARK = require('../../assets/logo-dark.png');   // logo sombre -> thème clair
const BUNDLED_LIGHT = require('../../assets/logo-light.png'); // logo blanc -> thème sombre
const BUNDLED_RATIO = 1000 / 581;

/**
 * Logo du label (Whales Records). Préfère le logo configuré côté back-office
 * (label-settings, variante sombre incluse) ; sinon repli sur le logo EMBARQUÉ
 * thème-aware — donc il s'affiche toujours, même hors connexion ou si l'API
 * ne renvoie rien.
 */
export function LabelLogo({ height = 26, maxWidth = 150 }: { height?: number; maxWidth?: number }) {
  const { theme } = useTheme();
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
  // Repli embarqué (toujours présent)
  return (
    <Image
      source={theme === 'dark' ? BUNDLED_LIGHT : BUNDLED_DARK}
      resizeMode="contain"
      style={{ height, width: Math.round(height * BUNDLED_RATIO) }}
    />
  );
}

