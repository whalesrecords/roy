# Whales Records — Mobile apps

Two Capacitor wrappers that turn the existing Next.js sites into native iOS / Android apps. Each app loads the production web URL inside a native WebView, so every Vercel deploy goes live in the app instantly.

```
mobile/
├── admin/       → com.whalesrecords.admin    → admin.whalesrecords.com
└── artist/      → com.whalesrecords.artist   → royalties-artist.vercel.app
```

## Why this approach

- **No frontend rewrite.** The Next.js apps run unchanged on Vercel and the mobile apps just point at them. Updates ship as fast as a `vercel deploy`.
- **App Store / Play Store presence.** Each shell is a real signed binary you can submit, with its own bundle ID, icon, splash screen, push token, biometric login.
- **One codebase per platform** for any native features (push notifications, deep links, file pickers, share sheet, biometric auth).
- **Trade-off** : every screen needs internet — offline mode is not in scope for v1.

## Prerequisites (on a Mac)

```bash
# iOS toolchain
xcode-select --install            # Xcode + Command Line Tools
sudo gem install cocoapods         # Pods package manager

# Android toolchain
brew install --cask android-studio
brew install openjdk@17
```

## Setup (do once per app)

### Admin app

```bash
cd mobile/admin
npm install
npx cap add ios
npx cap add android
npx cap sync
```

### Artist app

```bash
cd mobile/artist
npm install
npx cap add ios
npx cap add android
npx cap sync
```

This generates `ios/` and `android/` native projects next to `capacitor.config.ts`. They are gitignored — each developer regenerates them locally (Capacitor's recommended workflow).

## Local development

```bash
# Open in Xcode (iOS simulator + device deploy)
cd mobile/admin && npm run open:ios

# Open in Android Studio (emulator + device deploy)
cd mobile/admin && npm run open:android

# Point the app at a staging URL instead of prod
CAPACITOR_SERVER_URL=https://admin-staging.whalesrecords.com npx cap sync
```

## Production builds

### iOS

1. `cd mobile/admin && npm run open:ios`
2. In Xcode → **Signing & Capabilities** → set your Team
3. Select **Any iOS Device** → **Product → Archive**
4. Distribute App → App Store Connect → upload

### Android

1. `cd mobile/admin && npm run open:android`
2. Build → Generate Signed Bundle / APK → Android App Bundle
3. Use the same keystore for every release (lose it = lose Play Store access)
4. Upload the `.aab` to Play Console

## What's wired

- **Splash screen** : dark background (`#0A0A0A`), 1.2s duration. Replace `resources/splash.png` in each app folder to customize.
- **Status bar** : dark style (light text on dark background).
- **Push notifications** : `@capacitor/push-notifications` is installed but you still need to:
  - Apple : enable Push Notifications capability in Xcode + create a key in Apple Developer
  - Google : add `google-services.json` to `android/app/` from Firebase
  - Implement the registration handler in the web app (`Capacitor.Plugins.PushNotifications.register()`)
- **Auth** : the apps inherit whatever auth the production site uses. For mobile-grade UX consider:
  - Moving from admin-token query param to Supabase Auth + native biometric unlock via `@capacitor/biometric-auth`
  - Keychain / Keystore secure storage via `@capacitor-community/secure-storage`

## Bundle IDs

| App | Bundle ID | Apple Team prefix | Android namespace |
|---|---|---|---|
| Admin | `com.whalesrecords.admin` | _your team_ | `com.whalesrecords.admin` |
| Artist | `com.whalesrecords.artist` | _your team_ | `com.whalesrecords.artist` |

Two separate App Store / Play Store listings. Use the same Apple Developer account / Google Play Console for both.

## Updating the apps after a web deploy

Nothing to do — both apps load their `server.url` at launch, so a `vercel deploy` of `frontend` or `frontend-artist` updates the apps automatically. Only push a new binary when you change:

- Bundle ID / icon / splash
- Native plugins (added a new `@capacitor/*` package)
- iOS / Android SDK target version

## Pointing at the eventual production URLs

Today `mobile/artist/capacitor.config.ts` uses `royalties-artist.vercel.app`. Once you wire `artists.whalesrecords.com` (or whatever subdomain), update the `url` and the `allowNavigation` list, then `npx cap sync` and ship a new binary.
