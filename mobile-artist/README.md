# Espace Artiste — App mobile (iOS / Android)

App native React Native (Expo) pour l'espace artiste Whales Records. Réutilise
la même API que l'app web (`api.whalesrecords.com`) et le même design (thème
clair/sombre + accent paramétrable).

## Stack
- **Expo SDK 51** / React Native 0.74
- **React Navigation** (onglets + stacks)
- **react-native-svg** (icônes + graphiques), **expo-secure-store** (token), **AsyncStorage** (préférences)

## Démarrer en dev
```bash
cd mobile-artist
npm install
npm start            # puis 'i' (iOS), 'a' (Android), ou scanner le QR avec Expo Go
```
URL de l'API surchargée via `EXPO_PUBLIC_API_URL` (défaut : production).

## Vérifs
```bash
npm run typecheck    # tsc --noEmit
```

## Builds natifs & stores (EAS)
Le build iOS ne nécessite pas de Mac grâce à EAS Build (cloud).
```bash
npm i -g eas-cli
eas login
eas build:configure
eas build --platform ios       # nécessite un compte Apple Developer (99 $/an)
eas build --platform android   # génère un .aab pour le Play Store
eas submit --platform ios      # soumission App Store
eas submit --platform android  # soumission Play Store
```
Identifiants de bundle : `com.whalesrecords.artist` (iOS + Android).

## État d'avancement
- [x] Fondations : config, thème, i18n, auth (SecureStore), client API, navigation, primitives UI
- [x] Écrans Login + Accueil
- [ ] Musique, Statistiques
- [ ] Relevés, Paiements
- [ ] Promo (Spotify Ads), Support, Réglages
- [ ] Icône/splash, push notifications, build EAS + soumission stores

## Assets manquants
Ajouter avant build : `assets/icon.png` (1024×1024), `assets/splash.png`,
`assets/adaptive-icon.png` (Android). Référencés dans `app.config.ts` une fois
fournis.
