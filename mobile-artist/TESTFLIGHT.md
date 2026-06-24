# Mettre l'app sur TestFlight (puis App Store)

Build dans le cloud avec **EAS** (pas besoin de Mac pour compiler iOS).
Tout se lance depuis le dossier `mobile-artist/`.

## Prérequis
- Un **compte Expo** (gratuit) → https://expo.dev (crée-le si besoin).
- Ton **compte Apple Developer** payant (déjà OK).
- Node installé.

## 1. Installer l'outil EAS (une fois)
```bash
npm install -g eas-cli
```

## 2. Se placer dans le dossier de l'app
```bash
cd mobile-artist
```

## 3. Se connecter à Expo
```bash
eas login
```

## 4. Lier le projet (crée le projet sur ton compte Expo)
```bash
eas init
```
→ Accepte. Ça remplit automatiquement le `projectId` dans `app.json`.

## 5. Lancer le build iOS (cloud)
```bash
eas build --platform ios --profile production
```
- Connecte-toi à **Apple** quand c'est demandé (Apple ID + code 2FA).
- Quand il propose de **gérer les certificats / provisioning automatiquement** → réponds **Yes** (EAS s'occupe de tout).
- Le build tourne ~10–20 min sur les serveurs Expo. À la fin tu as un `.ipa`.

## 6. Envoyer sur TestFlight (App Store Connect)
```bash
eas submit --platform ios --latest
```
- Reconnecte-toi à Apple si demandé.
- S'il n'existe pas encore d'app sur App Store Connect avec le bundle
  `com.whalesrecords.artist`, EAS propose de **la créer** → accepte.
- Le build est téléversé sur App Store Connect.

## 7. Activer les testeurs (TestFlight)
1. Va sur https://appstoreconnect.apple.com → **Mon app** → onglet **TestFlight**.
2. Attends que le build passe de « En cours de traitement » à « Prêt à tester » (~10–30 min).
3. **Test interne** : ajoute des testeurs internes (membres de ton équipe) → dispo tout de suite, sans revue.
4. **Test externe** (autres personnes) : crée un groupe + soumets à une **revue bêta** (rapide, ~1 jour).
5. Les testeurs installent l'app **TestFlight** sur iPhone et reçoivent une invitation.

## Mises à jour suivantes
À chaque nouvelle version : refais `eas build --platform ios --profile production`
puis `eas submit --platform ios --latest`. Le numéro de build s'incrémente
automatiquement (`autoIncrement` dans `eas.json`).

## Infos utiles
- **Bundle ID** : `com.whalesrecords.artist`
- **Nom affiché** : Whales Records
- **API** : l'app pointe sur `https://api.whalesrecords.com` (prod)
- Chiffrement : déclaré « exempt » (HTTPS standard) → pas de question export à chaque envoi.

> ⚠️ Ces commandes doivent être lancées par toi (connexion Apple + 2FA + ton
> quota de build EAS). Je ne peux pas les exécuter à ta place, mais le projet
> est entièrement prêt — il n'y a qu'à suivre les étapes.
