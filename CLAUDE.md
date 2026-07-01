# Whales Records — Royalties Platform

Plateforme de gestion des **royalties musicales** pour labels (multi-tenant).

## Composants
- **API backend** : FastAPI (async SQLAlchemy) · déploie depuis `main` via Coolify (Hetzner) · `api.whalesrecords.com`
- **Web admin** : `frontend/` (Next.js) · Vercel `royalties-admin` · déploie depuis `main`
- **Web artiste (PWA)** : `frontend-artist/` (Next.js) · Vercel `royalties-artist` · déploie depuis `main`
- **App native admin** : `mobile-admin/` (Expo/RN) · iOS TestFlight
- **App native artiste** : `mobile-artist/` (Expo/RN) · iOS TestFlight
- **Base** : Supabase (projet `huolkgcnizwrhzyboemd`)

L'**app admin = l'outil des labels** (chaque label ne voit QUE ses données ; Whales = super-admin global).
L'**app artiste = espace de l'artiste** (revenus, relevés, contrats à signer, promo).

## ⭐ UX / ergonomie — à appliquer par défaut
Pour **toute** conception ou modification d'interface (web ou mobile), agir comme un·e
spécialiste UX/UI senior (iOS, Android, web) et appliquer par défaut le
**`docs/UX_GUIDE.md`** (référence maîtresse : standards plateformes 2025-2026 — Apple HIG,
Material 3, WCAG 2.2 AA, Core Web Vitals — + lois UX validées + engagement éthique +
dark patterns proscrits). `docs/UX_PRINCIPLES.md` en reste le résumé rapide.
Points clés : libellé+champ+placeholder distincts, champs obligatoires signalés,
**validation en temps réel + erreur au niveau du champ**, guidage, gestion d'erreur
courtoise (jamais de popup native brute), cohérence, cibles ≥44-48 px espacées ≥8 px,
contrastes ≥4,5:1 (info jamais portée par la couleur seule), feedback système <400 ms,
`prefers-reduced-motion` respecté, wireframe avant design, auto-audit (checklist §12).
En cas de doute → clarté, accessibilité et intérêt réel de l'utilisateur.

## Conventions de déploiement
- Développer sur la branche de feature ; ne jamais pousser direct sur `main`.
- **Backend / web** : reporter le(s) commit(s) sur une branche basée sur `origin/main`
  (cherry-pick) → PR → **squash merge** → Coolify (backend) / Vercel (web) redéploient.
- **Mobile** : `cd mobile-admin|mobile-artist` puis `eas build --platform ios --profile production --non-interactive --auto-submit` (nécessite `EXPO_TOKEN`).
- Nouvelles tables SQLAlchemy : créées au boot. Modifs de colonnes : bloc de migration
  idempotent dans `app/main.py` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS …`).

## Multi-tenant (isolation des labels)
- **Structure hybride** : base partagée cloisonnée par défaut (isolation par `label_id`
  + filtrage applicatif + RLS Postgres) ; base dédiée possible plus tard pour un cas
  ultra-exceptionnel.
- Modèles : `labels`, `label_members`, `artist_labels` (artiste partageable, many-to-many),
  `label_distributors`. Toutes les tables de données portent un `label_id`.
- Contexte : `app/core/tenancy.py` (`get_label_context`, `apply_label_scope`). Super-admin
  (token web partagé ou membre `is_platform_admin`) → aucun filtre ; admin de label → filtré.
- Backfill `label_id` → tâche de fond par lots (certaines tables > 1M lignes).
- Plan & avancement : `LABEL_ONBOARDING_PLAN.md`.

## Docs de référence
- `docs/UX_GUIDE.md` — **guide UX/UI maître** (senior iOS/Android/web, standards 2025-2026,
  lois UX, accessibilité WCAG 2.2, éthique, dark patterns) — appliquer par défaut.
- `docs/UX_PRINCIPLES.md` — résumé rapide des principes UX.
- `docs/AUDIT_HEURISTIQUE.md` — audit heuristique multi-plateforme (trouvailles + priorités).
- `LABEL_ONBOARDING_PLAN.md` — inscription des labels + isolation (lots).
- `REPRISE_DE_ZERO.md` — reprendre le projet depuis un environnement neuf.
- `DEPLOY.md` / `VERCEL_DEPLOY.md` — recréer l'infra.
