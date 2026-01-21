# Royalties Desktop App

Application desktop macOS pour la gestion des royalties, construite avec Tauri.

## Prérequis

1. **Rust** - Installer via rustup :
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Node.js** - Version 18+

3. **Xcode Command Line Tools** (macOS) :
   ```bash
   xcode-select --install
   ```

## Installation

```bash
cd desktop-app
npm install
```

## Développement

Lancer l'application en mode développement :

```bash
npm run dev
```

Cela va :
1. Démarrer le serveur Next.js du frontend
2. Ouvrir l'application Tauri

## Build

Compiler l'application pour macOS :

```bash
npm run build:mac
```

L'application compilée sera dans `src-tauri/target/release/bundle/`.

## Régénérer les icônes

Si vous modifiez le logo, régénérez les icônes :

```bash
./generate-icons.sh
```
