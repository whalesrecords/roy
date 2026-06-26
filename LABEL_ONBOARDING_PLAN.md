# 🏷️ Plan détaillé — Inscription & isolation des labels

> **But** : permettre à un nouveau label de **créer son compte lui-même**
> (nom, logo, artistes, distributeurs, outils) et garantir que **chaque label
> est ABSOLUMENT séparé de tous les autres**, sauf cas exceptionnel de
> regroupement explicite.
>
> Décisions déjà prises avec toi :
> - **Base partagée + RLS** (une seule base Postgres/Supabase, isolation par
>   `label_id` + Row Level Security), pas une base par label.
> - **Plan détaillé d'abord**, implémentation ensuite.
>
> Ce document est le plan d'exécution concret, **ancré dans le code actuel**.
> La vision SaaS large (domaines custom, billing Stripe, Redis, load-balancers)
> reste décrite dans `MULTI_TENANT_ARCHITECTURE.md` ; ici on se concentre sur
> ce qu'il faut livrer **maintenant** : l'onboarding + l'étanchéité des données.

---

## 0. État actuel (point de départ honnête)

Ce que dit le code aujourd'hui :

| Sujet | Réalité actuelle | Conséquence pour le multi-tenant |
|---|---|---|
| **Tenant** | Aucun. Il existe une seule ligne `label_settings` (le label = Whales Records, implicite). | Il faut introduire une vraie entité `labels` et y rattacher tout. |
| **Artistes** | `artists` n'a **pas** de `label_id`. | À ajouter sur `artists` **et toutes les tables filles**. |
| **Auth admin** | `verify_admin_token` = liste blanche d'e-mails (`ADMIN_EMAILS`) OU token partagé. Aucune notion de « quel label ». | Il faut résoudre le label de l'admin connecté et le propager. |
| **Connexion DB** | SQLAlchemy se connecte avec **une seule URL privilégiée** (`DATABASE_URL`). Cette connexion **bypass la RLS Supabase** (rôle propriétaire). | ⚠️ La RLS « JWT Supabase » ne s'applique PAS automatiquement à ce backend. L'isolation doit être **garantie côté application** ; la RLS Postgres devient une **2ᵉ ligne de défense** (voir §3). |
| **Tables clés** | `artists`, `artist_profiles`, `contracts`, `contract_parties`, `contract_signatures`, `contract_track_contributors`, `statements`, `transactions_normalized`, `royalty_runs`, `royalty_line_items`, `advance_ledger`, `products`, `transactions`/dépenses, `imports`, `promo_campaigns`, `promo_submissions`, `spotify_*`, `match_suggestions`, `tickets*`, `notifications`, `artist_notifications`, `push_tokens`, `artist_push_tokens`, `artist_tokens`, `manual_release`, `manual_track`, `artwork`, `fixed_assets`, `label_settings`. | Toutes deviennent **tenant-scoped** (porteuses d'un `label_id`). |

**Principe directeur** : comme l'API backend est **le seul chemin** vers les
données (les apps mobile/web ne parlent jamais à Postgres en direct),
l'isolation **primaire** est applicative : *toute* requête est filtrée par le
`label_id` du contexte. La RLS Postgres est ajoutée en **défense en profondeur**
pour qu'une erreur de code ne puisse pas fuiter des données entre labels.

---

## 1. Modèle de données

### 1.1 Nouvelle table centrale `labels`

```python
# app/models/label.py
class Label(Base):
    __tablename__ = "labels"

    id: UUID  (pk)
    slug: str            # unique, ex "whales-records" — sert d'URL/clé lisible
    name: str            # "Whales Records"
    logo_url / logo_base64 / logo_dark_base64   # repris de label_settings
    accent_color: str    # branding (ex "#EF7E2E")
    status: str          # "active" | "pending" | "suspended"
    plan: str            # "free" | "pro" ... (placeholder, billing plus tard)
    country: str
    created_at / updated_at
```

> `label_settings` (adresse, SIRET, TVA, contacts PDF) devient un **détail
> rattaché à un label** : on lui ajoute `label_id` (FK unique → labels) au lieu
> d'être un singleton.

### 1.2 Appartenance des admins : `label_members`

Un humain peut administrer **un** label (cas normal) ou **plusieurs** (cas
exceptionnel de regroupement → c'est le SEUL mécanisme qui autorise le partage).

```python
# app/models/label_member.py
class LabelMember(Base):
    __tablename__ = "label_members"
    id: UUID (pk)
    label_id: UUID  (FK labels, on delete cascade)
    auth_user_id: str        # Supabase auth.users.id
    email: str               # dénormalisé pour résolution rapide
    role: str                # "owner" | "admin" | "viewer"
    created_at
    # contrainte unique (label_id, auth_user_id)
```

- **Isolation stricte par défaut** : 1 admin ↔ 1 label.
- **Regroupement (ultra-exceptionnel)** : on crée plusieurs `label_members`
  pour le même `auth_user_id` sur des `label_id` différents. C'est volontaire,
  tracé, et réservé au super-admin plateforme.

### 1.3 `label_id` sur TOUTES les tables tenant

Ajout d'une colonne `label_id UUID NOT NULL` (FK `labels.id`) + index sur :

```
artists, artist_profiles, contracts, contract_parties,
contract_signatures, contract_track_contributors, statements,
transactions_normalized, royalty_runs, royalty_line_items,
advance_ledger, products, transactions (dépenses), fixed_assets,
imports, promo_campaigns, promo_submissions, spotify_ad_campaigns,
spotify_track_suggestions, match_suggestions, manual_release,
manual_track, artwork, tickets, ticket_messages, ticket_participants,
notifications, artist_notifications, push_tokens, artist_push_tokens,
artist_tokens, label_settings
```

> Pour les tables « filles » (ex `contract_parties`, `royalty_line_items`),
> `label_id` est **dénormalisé** (recopié du parent) afin que la RLS et les
> filtres soient simples et rapides (pas de jointure pour vérifier l'accès).

### 1.4 Distributeurs & outils du label

Le label déclare, à l'inscription, comment il distribue et quels outils il
utilise. On stocke ça de façon structurée et **éditable** :

```python
# app/models/label_distributor.py
class LabelDistributor(Base):
    __tablename__ = "label_distributors"
    id: UUID (pk)
    label_id: UUID (FK labels)
    kind: str        # "digital" | "physical" | "online_sales" | "tool"
    name: str        # ex "Believe", "Differ-ant", "Bandcamp", "SubmitHub"
    account_ref: str # identifiant de compte / contrat (optionnel)
    notes: str
    created_at
```

Un seul modèle paramétré par `kind` (plus simple qu'une table par catégorie).
Voir §6 pour les **listes de référence** proposées à l'inscription.

---

## 2. Stratégie de migration des données existantes

L'app tourne déjà avec les données Whales Records. On ne casse rien :

1. **Créer le label #1** « Whales Records » (slug `whales-records`) avec le
   `label_settings` actuel rapatrié dessus.
2. **Backfill** : `UPDATE <table> SET label_id = '<whales-id>'` pour toutes les
   lignes existantes (script idempotent au démarrage, comme les migrations
   `ALTER TYPE … ADD VALUE IF NOT EXISTS` déjà présentes dans `main.py`).
3. Créer les `label_members` pour les e-mails de `ADMIN_EMAILS` actuels
   (`hello@`, `royalties@`, `lea.hf@`) → tous rattachés à Whales Records.
4. Une fois le backfill validé, passer les colonnes `label_id` en `NOT NULL`.

> Comme `Base.metadata.create_all` crée les **nouvelles tables** automatiquement
> au boot, mais **n'altère pas** les tables existantes, l'ajout de colonnes
> `label_id` se fait via le bloc de migration SQL idempotent de `main.py`
> (`ALTER TABLE … ADD COLUMN IF NOT EXISTS label_id UUID`).

---

## 3. Isolation — double verrou

### Verrou 1 (primaire) : filtrage applicatif obligatoire

- Une dépendance FastAPI `get_label_context(...)` résout le label de l'appelant :
  - **App/Web admin** : à partir du JWT Supabase → `label_members.auth_user_id`
    (ou du token partagé → label par défaut Whales tant qu'on est mono-label).
  - **App artiste** : à partir de l'artiste authentifié → `artists.label_id`.
- Un helper de requête `scoped(query, ctx)` ajoute systématiquement
  `.where(Model.label_id == ctx.label_id)`. **Aucune** requête tenant ne part
  sans passer par là (revue de code + tests).
- À l'écriture, `label_id` est forcé au `ctx.label_id` (jamais accepté du
  client), pour empêcher l'injection cross-tenant.

### Verrou 2 (défense en profondeur) : RLS Postgres

Même si le backend se connecte avec un rôle privilégié, on peut activer la RLS
et **transmettre le label courant** à la base par transaction :

```sql
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON artists
  USING (label_id = current_setting('app.current_label_id', true)::uuid);
```

```python
# au début de chaque requête, dans get_db / middleware :
await session.execute(
    text("SET LOCAL app.current_label_id = :lid"), {"lid": str(ctx.label_id)}
)
```

- Pour que la RLS **s'applique réellement** au backend, soit on exécute les
  requêtes tenant via un **rôle non-superuser** dédié (`app_tenant`), soit on
  force `FORCE ROW LEVEL SECURITY` sur les tables. Le rôle de migration/admin
  garde le bypass pour le backfill et le super-admin.
- Avantage : une requête qui oublierait le filtre applicatif **ne peut quand
  même pas** voir un autre label.

> ⚠️ Point d'attention explicite : aujourd'hui `DATABASE_URL` = rôle
> propriétaire → la RLS serait ignorée. Le verrou 2 nécessite donc soit un rôle
> applicatif dédié, soit `FORCE RLS`. Tant que ce n'est pas en place, **le
> verrou 1 (applicatif) est l'isolation réelle** et doit être traité comme
> critique (tests d'étanchéité obligatoires, §5).

---

## 4. Parcours d'inscription (self-service)

### 4.1 UX — assistant en étapes

Page publique `/signup` (web admin) + écran équivalent app admin :

1. **Compte** : e-mail + mot de passe (création GoTrue Supabase), ou « j'ai
   déjà un compte ».
2. **Label** : nom, pays, logo (upload → base64/stockage), couleur d'accent.
   → slug auto-généré, vérifié unique.
3. **Artistes** : recherche **Spotify** (réutilise l'intégration existante
   `app/routers/spotify.py`) → sélection multiple → pré-crée les `artists` du
   label (nom, `spotify_id`, image).
4. **Distribution** : 3 listes à cocher + champ libre —
   **Digital**, **Physique**, **Vente en ligne** (listes §6).
5. **Outils** : promo / analytics / smartlinks (liste §6).
6. **Récap & validation** → création atomique (voir 4.2), `status="active"`.

### 4.2 Endpoint backend

```
POST /api/public/labels/signup        (non authentifié OU JWT fraîchement créé)
  body: { account, label, artists[], distributors[], tools[] }
  → transaction unique :
      1. create Label (status pending→active)
      2. create LabelSettings(label_id)
      3. create LabelMember(owner, auth_user_id, email)
      4. bulk create Artists(label_id)            (depuis sélection Spotify)
      5. bulk create LabelDistributor(label_id)   (kind digital/physical/online_sales/tool)
  → renvoie { label_id, slug }
```

- **Anti-abus** : rate-limit, e-mail vérifié (lien GoTrue), slug réservé
  (liste noire `admin`, `api`, `platform`…).
- **Validation Spotify** : on ne fait confiance qu'aux IDs renvoyés par notre
  propre proxy de recherche, pas à des champs libres côté client.

### 4.3 Super-admin plateforme

- Un flag `is_platform_admin` (sur `label_members` ou table dédiée) pour
  `hello@whalesrecords.com` : voit/gère **tous** les labels, peut créer un
  regroupement (multi-`label_members`), suspendre, etc.
- Tous les autres comptes sont **strictement** limités à leur label.

---

## 5. Tests d'étanchéité (non négociables)

Le cœur de l'exigence « ABSOLUMENT séparé ». À écrire **avant** la mise en prod :

- **Test cross-tenant lecture** : Label A ne voit jamais artistes/contrats/
  relevés/imports/promo/tickets de Label B (1 test par router).
- **Test cross-tenant écriture** : un POST/PUT de A référençant un `id` de B
  → 404 (pas 403, pour ne pas révéler l'existence).
- **Test injection `label_id`** : un client qui envoie `label_id` d'un autre
  label est ignoré/refusé.
- **Test regroupement** : un membre multi-labels voit bien l'union, et
  uniquement ses labels.
- **Test RLS** (si verrou 2 activé) : requête brute sans `SET app.current_label_id`
  → 0 ligne.

---

## 6. Listes de référence (distributeurs & outils)

Pré-remplies dans l'assistant, **cochables + champ libre** (le label complète).

### 6.1 Distributeurs digitaux (streaming / téléchargement, agrégateurs)
Believe / TuneCore · The Orchard (Sony) · FUGA · IDOL · Wagram (Believe) ·
DistroKid · CD Baby · Symphonic Distribution · AWAL · ONErpm · Ditto Music ·
Horus Music · iMusician · RouteNote · Amuse · Label Worx · Absolute Label
Services · Kontor New Media · Believe Backstage · *(autre…)*

### 6.2 Distributeurs physiques (CD / vinyle)
Believe Distribution Services · The Orchard (physique) · PIAS ·
Differ-ant · Modulor · Socadisc · L'Autre Distribution · Musicast ·
Wagram Music · Season of Mist Distribution · Rough Trade · Cargo Records ·
Border Music · Plastic Head · SRD / Code 7 · Naxos (classique) · *(autre…)*

### 6.3 Sites de vente en ligne (D2C & marketplaces)
Bandcamp · Boutique Shopify · Big Cartel · Music Glue · Bandzoogle ·
Amazon (Marketplace / Music) · Apple Music Store · Qobuz Store ·
Beatport · Juno · 7digital · Discogs Marketplace · Fnac.com · Cultura ·
eBay · Etsy · *(autre…)*

### 6.4 Outils (promo / analytics / smartlinks)
SubmitHub · Groover · Spotify for Artists · Apple Music for Artists ·
Meta Ads · Spotify Ad Studio · Chartmetric · Soundcharts · Songstats ·
Viberate · Linkfire · Feature.fm · Linktree · *(autre…)*

> Ces listes sont un **point de départ éditable**, pas une vérité figée. Elles
> seront stockées en config (pas en dur) pour être mises à jour sans redéploiement.

---

## 7. Découpage en lots (ordre d'implémentation)

| Lot | Contenu | Dépend de |
|---|---|---|
| **L1 — Modèle & migration** | Tables `labels`, `label_members`, `label_distributors` ; `label_id` partout + backfill Whales ; `label_settings.label_id`. | — |
| **L2 — Contexte & filtrage** | `get_label_context`, helper `scoped()`, forçage `label_id` en écriture, refactor de tous les routers tenant. | L1 |
| **L3 — Tests d'étanchéité** | Suite cross-tenant (lecture/écriture/injection). | L2 |
| **L4 — Inscription** | `POST /public/labels/signup`, assistant web `/signup`, écran app admin, recherche Spotify, listes distributeurs/outils. | L2 |
| **L5 — Super-admin & regroupement** | `is_platform_admin`, gestion multi-labels, suspension. | L2 |
| **L6 — RLS (défense en profondeur)** | Rôle `app_tenant` + policies + `SET LOCAL`. | L2 |
| **L7 — Branding par label** | Logo/couleur/nom injectés dans web, apps, et PDF (relevés/contrats). | L1 |

> Billing (Stripe), domaines custom et scaling infra restent **hors périmètre
> immédiat** (cf. `MULTI_TENANT_ARCHITECTURE.md`) — à activer quand il y aura de
> vrais labels payants.

---

## 8. Risques & décisions à confirmer

1. **RLS réelle vs filtrage applicatif** : veux-tu qu'on investisse tout de
   suite dans le rôle `app_tenant` + RLS (verrou 2), ou qu'on démarre avec le
   verrou 1 (applicatif + tests) et qu'on ajoute la RLS juste après ? *(Reco :
   verrou 1 d'abord pour livrer vite, RLS en lot L6 rapproché.)*
2. **Slug / URL** : un sous-domaine par label (`label.roy…`) ou un simple
   sélecteur de label dans l'app ? *(Reco : sélecteur d'abord, sous-domaine
   plus tard.)*
3. **Validation des inscriptions** : auto-activation, ou modération par le
   super-admin avant activation ? *(Reco : modération légère au début.)*
4. **Artistes partagés** entre labels (un même artiste signé ailleurs) : par
   défaut **interdit** (isolation stricte) ; un artiste = un label. OK ?
```
