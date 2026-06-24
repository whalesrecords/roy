# Whales Records — Native apps

Two **real native** iOS + Android apps built with React Native (Expo SDK 52), TypeScript, expo-router. **Not** WebView wrappers — every screen is a native component matching the ROY redesign tokens (`#0A0B0D` background, mint `#15CE8E` accent, Schibsted Grotesk + IBM Plex Mono).

```
native-apps/
├── admin/      → com.whalesrecords.admin     → /api proxied to admin backend
└── artist/     → com.whalesrecords.artist    → /artist-portal endpoints
```

## What's inside each app

```
admin/
├── app/                   expo-router file-based routing
│   ├── _layout.tsx        root providers (theme, auth, query client)
│   ├── auth/login.tsx     email + password login screen
│   ├── (tabs)/            bottom tab group
│   │   ├── _layout.tsx    tab bar with the 4 admin icons
│   │   ├── index.tsx      Tableau de bord
│   │   ├── royalties.tsx  hero "Total dû" + breakdown
│   │   ├── artists.tsx    search + list + detail sheet
│   │   └── finances.tsx   KPI + categories
├── components/            shared primitives
│   ├── Card.tsx
│   ├── Kpi.tsx
│   ├── Pill.tsx
│   ├── BottomSheet.tsx    react-native-reanimated based
│   └── Eyebrow.tsx
├── lib/
│   ├── theme.ts           tokens + accent + dark/light context
│   ├── api.ts             fetch client with auth token persistence
│   └── auth.ts            login + secure storage of tokens
├── assets/fonts/          Schibsted Grotesk + IBM Plex Mono .ttf
├── app.json               Expo config (bundle id, icon, splash)
├── eas.json               EAS build profiles (preview, production)
└── package.json
```

## Local dev

```bash
cd native-apps/admin
npm install
npx expo start
```

Then scan the QR with **Expo Go** on your iPhone (App Store) or Android.

## Cloud builds (no Mac needed)

Builds run on Expo's macOS/Linux fleet, no local Xcode required.

### One-time setup (per app, run locally first)

```bash
npm install -g eas-cli
eas login                            # uses your Expo account

cd native-apps/admin
eas init                             # creates the Expo project + writes
                                     # extra.eas.projectId in app.json.
                                     # Commit that file after.

cd ../artist
eas init
git add -A && git commit -m "chore: link EAS projectIds"
```

If you skip `eas init`, builds fail with **"Invalid UUID appId"** — EAS
needs a real project ID, not a placeholder. Once `eas init` has run,
the `app.json` of each app contains `extra.eas.projectId` and CI builds
will resolve it automatically.

### Building

```bash
eas build --profile preview --platform ios       # → .ipa downloadable
eas build --profile preview --platform android   # → .apk downloadable
```

Output URLs are shown in the terminal and emailed.

You can also trigger builds from GitHub Actions — see
`.github/workflows/native-apps-build.yml`. Requires `EXPO_TOKEN`
secret in repo settings, generated at
https://expo.dev/accounts/<your-account>/settings/access-tokens.

## Submitting to stores

```bash
eas submit --profile production --platform ios       # App Store Connect
eas submit --profile production --platform android   # Google Play Console
```

You'll need:
- Apple Developer account ($99/year) + an App in App Store Connect
- Google Play Console account ($25 one-time) + a release track

## Configuration to do before first build

1. **Backend URL** : `lib/api.ts` defaults to `https://api.whalesrecords.com`. If your backend is at a different URL, set `EXPO_PUBLIC_API_URL` in a `.env` file at the root of each app.
2. **Splash & icon** : drop a 1024×1024 PNG in `assets/icon.png` and `assets/splash-icon.png`. Expo auto-generates all the sizes.
3. **Fonts** : the Schibsted Grotesk and IBM Plex Mono `.ttf` files need to be added to `assets/fonts/` (Google Fonts download). Until then the app falls back to system fonts.
4. **Bundle IDs** : already set in `app.json`. Change if the App Store / Play namespace is taken.

## Stack

- Expo SDK 52
- React Native 0.76
- TypeScript strict
- expo-router (file-based)
- React Query for server state
- expo-secure-store for tokens
- react-native-reanimated for sheet animations
- @expo/vector-icons (Feather + MaterialCommunityIcons)
- expo-font for custom fonts
