# 🔄 Reprise de zéro — mode d'emploi

> À lire si tu te déconnectes et que tu **repars d'un environnement neuf**
> (nouvelle session Claude Code web, nouveau conteneur, machine vierge).
>
> Principe clé : **l'environnement d'exécution est éphémère**. Le conteneur est
> recyclé après inactivité. Seul ce qui est **commité + poussé sur GitHub**
> survit. Les déploiements en prod (Coolify, Vercel), Supabase et les builds
> déjà sur TestFlight, eux, restent en place.

---

## 0. Ce qui survit vs ce qui est perdu

| ✅ Survit (durable) | ❌ Perdu au redémarrage (à refaire) |
|---|---|
| Tout le code commité + poussé sur GitHub | Le conteneur, `node_modules`, le dossier `ios/` généré |
| La branche de dev `claude/admiring-mayer-0z032g` | Le **`EXPO_TOKEN`** (était dans `/tmp/.../scratchpad`, non commité) |
| `main` + déploiements prod (Coolify backend, Vercel web) | Toute variable d'env saisie à la volée dans le shell |
| La base Supabase (`huolkgcnizwrhzyboemd`) | Les fichiers temporaires (`/tmp`, scratchpad) |
| Les credentials EAS/Apple (stockés chez Expo) | — |
| Les builds déjà soumis sur TestFlight | — |

> ⚠️ **Le `EXPO_TOKEN` n'est jamais commité** (secret). Pour rebuild les apps,
> il faut le **re-fournir** à chaque nouvel environnement (voir §3).

---

## 1. Coordonnées du projet (carte mémoire)

| Élément | Valeur |
|---|---|
| **Repo GitHub** | `whalesrecords/roy` |
| **Branche de dev en cours** | `claude/admiring-mayer-0z032g` |
| **Backend** | FastAPI · déploie depuis `main` via **Coolify** (Hetzner) · `https://api.whalesrecords.com` |
| **Web admin** | `frontend/` · Vercel projet **royalties-admin** (`prj_vwKSMdQsrwqM2ykpSQZ6iJZGU7JR`) · déploie depuis `main` |
| **Web artiste (PWA)** | `frontend-artist/` · Vercel projet **royalties-artist** (`prj_4pV6kPlYmlG04V9VQBCSu9fbtx8R`) · déploie depuis `main` |
| **App native admin** | `mobile-admin/` · Expo `roy-admin` · projectId `c426dca8-fbde-4424-91fd-b108f25cd009` · bundle `com.whalesrecords.royadmin` · ascAppId `6784182227` |
| **App native artiste** | `mobile-artist/` · Expo `roy-artist` · projectId `716c45c8-cea1-4dd6-84d8-11b96e5ccd76` · bundle `com.whalesrecords.royartist` · ascAppId `6784146669` |
| **Compte Expo** | `whalesrecords` |
| **Équipe Apple** | `9VTP9D85PL` (Julien Marchal — Individual) |
| **Supabase** | projet `huolkgcnizwrhzyboemd` |
| **Vercel team** | `team_GOlKY2VzkSXUUWg2ako9PDzZ` |

---

## 2. Reprendre le code

```bash
git clone https://github.com/whalesrecords/roy.git
cd roy
git checkout claude/admiring-mayer-0z032g   # la branche de dev en cours
git pull origin claude/admiring-mayer-0z032g
```

> En session Claude Code web, le repo est déjà cloné ; il suffit de
> `git checkout` + `git pull` sur la bonne branche.

---

## 3. Secrets à re-fournir

- **`EXPO_TOKEN`** (indispensable pour builder/soumettre les apps) :
  - le récupérer sur **expo.dev → Account settings → Access tokens** (créer un
    token « robot » si besoin) ;
  - le passer **en variable d'env du shell uniquement**, jamais dans un commit :
    ```bash
    export EXPO_TOKEN="xxxxxxxx"
    ```
- Backend / Vercel : les secrets de prod (`DATABASE_URL`, `ADMIN_TOKEN`,
  `SPOTIFY_*`, etc.) sont déjà configurés côté Coolify et Vercel → **rien à
  refaire** tant qu'on ne recrée pas l'infra (sinon voir `DEPLOY.md` et
  `VERCEL_DEPLOY.md`).

---

## 4. Rebuild + soumettre les apps mobiles (le plus opérationnel)

Les apps se buildent **depuis la branche checkout** (pas besoin de passer par
`main`). EAS lit l'état git courant.

```bash
export EXPO_TOKEN="xxxxxxxx"          # cf. §3

# --- APP ADMIN ---
cd mobile-admin
npm install
npx eas-cli@latest build --platform ios --profile production --non-interactive --auto-submit

# --- APP ARTISTE ---
cd ../mobile-artist
npm install
npx eas-cli@latest build --platform ios --profile production --non-interactive --auto-submit
```

- `--auto-submit` enchaîne build **puis** soumission TestFlight (les `ascAppId`
  sont déjà dans chaque `eas.json`).
- `autoIncrement: true` + `appVersionSource: remote` → le numéro de build
  s'incrémente tout seul.
- **Suivre un build** : `npx eas-cli@latest build:list --platform ios --limit 3 --non-interactive`
- ✅ La capability **Push Notifications** est déjà activée sur les **deux**
  App IDs côté Apple → les builds passent sans retoucher aux credentials.

> Toujours `cd` dans le bon dossier (`mobile-admin` **ou** `mobile-artist`)
> avant `npm`/`eas` — lancer depuis la racine échoue.

---

## 5. Déployer un changement **backend** (Python / FastAPI)

Le backend déploie **depuis `main`** (Coolify redéploie automatiquement à
chaque push sur `main`). Le flux utilisé jusqu'ici :

1. Développer + committer sur la branche de dev.
2. Reporter le(s) commit(s) vers une branche basée sur `origin/main` :
   ```bash
   git fetch origin main
   git checkout -b deploy/ma-feature origin/main
   git cherry-pick <commits…>
   git push -u origin deploy/ma-feature
   ```
3. Ouvrir une **PR** vers `main`, puis **squash merge**.
4. Coolify détecte le push sur `main` → **redéploie** le backend.

> Les **nouvelles tables** SQLAlchemy sont créées automatiquement au démarrage
> (`Base.metadata.create_all`). Les **modifications de colonnes** sur des tables
> existantes se font via le bloc de migration SQL idempotent dans
> `app/main.py` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS …`).

---

## 6. Déployer un changement **web** (admin / artiste)

Vercel redéploie **automatiquement** à chaque push sur `main` :
- `frontend/` → royalties-admin
- `frontend-artist/` → royalties-artist

Donc : **merger vers `main` = déployer**. Même flux PR → squash merge qu'au §5.

> ⚠️ Piège déjà rencontré : une propriété dupliquée dans
> `export const viewport` de `frontend-artist/src/app/layout.tsx` a fait
> **échouer** le build Vercel. Vérifier ce fichier si un déploiement artiste
> casse.

---

## 7. Comptes & accès

- **Admins** (allowlist `ADMIN_EMAILS` dans `app/core/config.py`) :
  `hello@whalesrecords.com`, `royalties@whalesrecords.com`,
  `lea.hf@whalesrecords.com`.
- Auth admin : `X-Admin-Token` (proxy web) **ou** JWT Supabase dont l'e-mail
  est dans l'allowlist (apps natives + web).
- Le compte **lea.hf@whalesrecords.com** existe (admin), non rattaché à un
  artiste.
- Auth artiste : GoTrue Supabase (password grant) + `auth_user_id` sur la
  table `artists`.

---

## 8. État d'avancement & TODO

**✅ Fait et en prod / sur TestFlight :**
- Apps natives admin (W ardoise) + artiste (W orange) avec icônes distinctes.
- App artiste : push notifications + bandeau d'accueil « où aller ».
- Notification artiste à l'import promo (in-app + push téléphone).
- Contrats : titre d'album en gros (web + mobile), contributeurs par titre,
  signature électronique simple, nom d'album (pas que l'UPC).
- Backend : auth JWT admin, dédup Spotify Ads, allowlist lea.hf.

**🔜 À faire (validé « plan d'abord ») :**
- **Multi-tenant / inscription des labels** — plan dans
  `LABEL_ONBOARDING_PLAN.md`. **4 décisions à trancher** avant de coder :
  1. RLS Postgres tout de suite, ou filtrage applicatif d'abord + RLS juste après ?
  2. Sous-domaine par label, ou simple sélecteur de label ?
  3. Inscription auto-activée, ou modérée avant activation ?
  4. Un artiste = un seul label (isolation stricte) — à confirmer.
- **Backlog** : carte des libraires/bibliothèques + dispo des livres par ISBN.

**📄 Docs de référence dans le repo :**
- `LABEL_ONBOARDING_PLAN.md` — plan d'inscription + isolation.
- `MULTI_TENANT_ARCHITECTURE.md` — vision SaaS large.
- `DEPLOY.md` — infra Hetzner/Coolify (recréation backend).
- `VERCEL_DEPLOY.md` — recréation des fronts Vercel.

---

## 9. Pièges connus (à garder en tête)

1. **`cd` dans le bon dossier mobile** avant `npm`/`eas` (jamais depuis la racine).
2. **`git pull` bloqué** par une modif locale de `app.json` →
   `git stash && git pull && git stash pop`.
3. **Ne jamais committer** `EXPO_TOKEN` ni aucun secret.
4. **Push iOS** : capability *Push Notifications* déjà activée sur les 2 App IDs.
   Si une **nouvelle** app Expo ajoute le push, il faut cocher la capability sur
   l'App ID (Apple Developer → Identifiers → Push Notifications → Save), sinon le
   build échoue (« provisioning profile doesn't include the Push Notifications
   capability »).
5. **`ios/` est gitignoré** : un `expo prebuild` local sert juste de dépannage,
   il ne doit pas être commité.
6. **Crédits EAS** : le quota mensuel inclus peut être épuisé → builds facturés
   à l'usage (compte payant actif).
</content>
