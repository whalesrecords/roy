# Whales Admin — build & TestFlight

App admin native (Expo / React Native, SDK 56). Mêmes fondations que `mobile-artist`,
mais authentification **par JWT Supabase** (e-mail + mot de passe de ton compte admin)
et écrans back-office (tableau de bord, artistes, royalties, finances, promo, support,
inventaire, réglages).

Bundle identifier : `com.whalesrecords.royadmin` (distinct de l'app artiste).
Tourne sur **iPhone, iPad et Mac (Apple Silicon, « Designed for iPad »)**.

## Prérequis (une seule fois)

```
npm install -g eas-cli
cd mobile-admin
npm install
eas login                 # compte Expo « whalesrecords »
eas init                  # crée le projet EAS et écrit extra.eas.projectId dans app.json
```

> `app.json` contient `extra.eas.projectId = "PLACEHOLDER_RUN_EAS_INIT"` :
> `eas init` le remplacera par le vrai identifiant.

## Authentification

L'app se connecte directement à Supabase (GoTrue) avec l'e-mail / mot de passe de
ton compte admin, récupère un JWT, et l'envoie au backend. Le backend n'accepte ce
JWT que si l'e-mail figure dans `ADMIN_EMAILS` (par défaut
`hello@whalesrecords.com,royalties@whalesrecords.com`).

⚠️ **Le backend doit être déployé** avec le commit
« routes admin acceptent un JWT Supabase » avant que la connexion fonctionne.
Pour ajouter un admin : ajouter son e-mail à la variable d'env `ADMIN_EMAILS`
(séparés par des virgules) côté Coolify, puis redéployer.

## Build iOS + envoi TestFlight

```
eas build --platform ios --profile production
eas submit --platform ios --latest
```

L'URL Supabase et la clé publique sont déjà dans `app.json`
(`extra.supabaseUrl`, `extra.supabaseKey`) — clés publiques, sans risque côté client.

## Tester sur simulateur

```
eas build --platform ios --profile preview   # build .app pour simulateur
# ou en local :
npx expo start
```
