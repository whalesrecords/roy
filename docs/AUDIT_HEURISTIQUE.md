# Audit heuristique UX — Whales Records

> Étude d'évaluation menée selon `docs/UX_PRINCIPLES.md` (heuristiques Nielsen /
> critères Bastien-Scapin, 12 règles d'ergonomie). Audit **en lecture seule**,
> constats **ancrés dans le code** (chemin + ligne). Deux produits audités :
> le **web admin** (`frontend/`) et l'**expérience artiste** (app native
> `mobile-artist/` + PWA `frontend-artist/`).
>
> **Gravité** : `1/3` mineur · `2/3` important · `3/3` majeur / prioritaire.

---

## 🎯 Synthèse exécutive — à traiter en premier

**Web admin** — 3 problèmes **systémiques** (touchent presque tous les écrans ;
les corriger une fois, au niveau des composants, règle des dizaines d'occurrences) :
- **A · Libellés non associés aux champs** (`htmlFor`/`id` absents) → cliquer le
  libellé ne focus pas le champ, lecteurs d'écran ne lisent pas le libellé (WCAG
  1.3.1/4.1.2). `components/ui/Input.tsx:22` + la plupart des formulaires.
- **B · 30 `alert()`/`confirm()` natifs** (validation, feedback, suppressions)
  hors charte, bloquants, sans `aria-live`, **sans annulation (undo)**.
- **C · Libellé = placeholder** + contraste des libellés `roy-eyebrow` ~2,9:1
  (< AA 4,5:1) + champs obligatoires non signalés.

**Expérience artiste** — le problème dominant est la **parité rompue entre l'app
native et la PWA** (un artiste ne vit pas la même plateforme selon l'appareil),
plus une **action financière non sécurisée** :
- **A · Signature de contrat absente du web** (PWA en lecture seule) → un artiste
  qui n'a que la PWA **ne peut pas signer** ses contrats.
- **B · `artist_share` incohérent** : natif `×100` (fraction→%), web brut → **une
  des deux plateformes affiche un % faux**.
- **C · Demande de versement sans confirmation ni récap** (montant/RIB/délai),
  action financière irréversible en un tap, échec silencieux (catch absent).
- **D · Login divergent** : natif = code **ou** e-mail ; web = e-mail seul → un
  artiste avec un *code* ne peut pas se connecter sur la PWA.
- **E · Bandeau notifs natif** : renvoie **toujours** vers `Promo` quel que soit
  le type, et `markAllNotificationsRead()` **efface tout** au tap.
- **F · Édition du RIB impossible sur natif** → un artiste 100 % mobile ne peut
  jamais renseigner son IBAN, donc ses versements ne peuvent aboutir.
- **G · Création de ticket impossible sur natif** (consultation seule).

---

# Partie 1 — Web admin (`frontend/`)

### Constats 3/3 (systémiques)
| # | Constat | Heuristique | Où |
|---|---------|-------------|----|
| A | Libellés non reliés aux champs (`htmlFor`/`id`), `Input` partagé non généralisé | Accessibilité, Formulaires, Fitts | `components/ui/Input.tsx:22`, `login`, `settings`, `inventory`, `catalog`, `promo`, … |
| B | 30 `alert()`/`confirm()` natifs (validation + feedback + suppressions sans undo) | Erreurs, Cohérence, Liberté | `contracts:407,412,451`, `inventory:199`, `catalog:728,755`, `royalties:137,154`, `FinancesTab:186,209,255`, `tickets/[id]:111`, … |
| C | Libellé = placeholder + contraste libellé < AA + obligatoires non signalés | Formulaires, Accessibilité | `catalog:770-791`, `artists:144-150`, `ContractContributorsModal:140-159`, … |

**Correctifs à fort levier** : (1) refondre `Input.tsx`/`Select.tsx` (`useId()` +
`htmlFor`, prop `required` → `*`, contraste libellé AA) et **imposer leur usage** ;
(2) composant `<ConfirmDialog>` accessible + toasts/erreurs inline → remplacer les
30 appels natifs (avec **undo** sur suppressions) ; (3) composant `Modal` accessible
(Échap, clic-dehors, focus-trap, `aria-modal`) + `Stepper` réutilisable (déjà présent
dans `imports/MappingStep`).

### Par écran (constats notables)
- **Layout / nav** — `2/3` zoom désactivé (`layout.tsx:51` `user-scalable=no`, WCAG 1.4.4) ; `2/3` bascule thème + pastilles d'accent < 44px (`Sidebar.tsx:219`) ; `1/3` `IconLogout` sur « Se connecter » (`login:100`) ; `1/3` « Label Manager » en dur (`Sidebar.tsx:244`).
- **Login** — `3/3` libellés `Eyebrow` non associés ; `2/3` erreur sans `role="alert"`/focus ; `1/3` pas d'afficher mot de passe ni « mot de passe oublié ».
- **Signup** — ✅ bien segmenté (6 étapes, progression, `htmlFor` corrects à l'étape 1) ; `2/3` validations en toast global (pas sous le champ) ; `2/3` message de confirmation e-mail confus ; `2/3` regex e-mail trop permissive ; `1/3` logo/couleur sans libellé associé.
- **Dashboard** — `2/3` KPI « Marge nette » ambigu (montant ou %?) ; `1/3` pas d'état vide guidant ; `1/3` « Revenus vs Dépenses » (juxtaposition) ; `1/3` imports récents non cliquables.
- **Artistes** — `3/3` recherche/onglets sans libellé ; `2/3` fusion (destructrice) sans confirmation/undo ; `2/3` onglets non sémantiques (`role="tab"` absent) ; `2/3` modales sans Échap/`aria-modal`.
- **Contrats** — `3/3` `alert/confirm` (validation, suppression, synchro dates) ; `2/3` logique dates bidirectionnelle opaque ; `2/3` total des parts validé seulement au clic, pas de `max=100` ; `2/3` contributeurs 3 champs sans libellé ; `1/3` coquilles d'accents dans les `alert`.
- **Finances** — `3/3` libellés non liés (dépense, export, import factures) ; `2/3` suppression inline fragile ; `2/3` `InvoiceImportModal` sans stepper + fermeture sans garde-fou pendant extraction (perte de données) ; `1/3` montant sans symbole €.
- **Royalties** — `3/3` `confirm()` paiement en masse / verrouillage ; `2/3` tableau non responsive (grille fixe) → vue cartes < md ; `1/3` libellés export sans contexte.
- **Inventaire** — `3/3` formulaires produit/immobilisations non liés ; `2/3` `confirm()` suppression ; `2/3` import Reverb jargonneux ; `1/3` upload CSV sans affordance DnD.
- **Catalogue** — `3/3` ajout de titre : « Titre * » en placeholder ; `2/3` modale liaison artistes (total 100% validé au clic) ; `2/3` `confirm()` suppression.
- **Imports (ventes)** — ✅ `MappingStep` a un bon fil d'étapes ; `2/3` flux global non numéroté + écran final sans retour `/imports` ; `2/3` cibles non marquées requis + liste à plat sans `<optgroup>` ; `2/3` `EmptyState` sans CTA.
- **Promo** — `2/3` **3 flux d'upload incohérents** (Groover bloque sur artiste inconnu, SubmitHub non, SpotifyAds sans preview) ; `2/3` `ManualPromoForm` libellés = placeholders ; `1/3` texte anglais résiduel.
- **Suggestions Spotify** — `2/3` « Ajouter »/« Ignorer » sans confirmation ni undo (API directe).
- **Tickets** — `2/3` filtres sans libellé ; `2/3` pas de feedback après envoi ; `2/3` « Note interne » peu visible (risque d'envoyer une note censée privée).

---

# Partie 2 — Expérience artiste (`mobile-artist/` + `frontend-artist/`)

### Constats 3/3
| # | Écran | Constat | Heuristique |
|---|-------|---------|-------------|
| A | Contrats (web) | PWA **en lecture seule** : aucun pavé de signature → l'artiste ne peut pas signer sur le web | 1,3,7 |
| B | Contrats (×plateforme) | `artist_share` : natif `Math.round(×100)` vs web brut → **% faux sur une plateforme** | 3,8 |
| C | Paiement | `requestPayment(...)` **sans confirmation ni récap** (montant/RIB/délai), échec silencieux (pas de `catch`) | 7,8,10 |
| D | Login | Natif = code **ou** e-mail ; web = e-mail seul → artiste avec *code* bloqué sur PWA | 1,3,4 |
| E | Notifs accueil (natif) | Renvoie **toujours** vers `Promo` (`DashboardScreen:142`) + `markAllNotificationsRead()` purge tout au tap | 5,7,10 |
| F | Réglages (natif) | **Édition RIB/IBAN impossible** sur natif → versement SEPA jamais renseignable en mobile | 1,3,12 |
| G | Support (natif) | **Création de ticket impossible** (consultation seule) → fonction cœur manquante | 1,7 |

### Par écran (constats notables)
- **Login** — `2/3` aucun recours « mot de passe oublié » / aide ; `2/3` natif ne désactive pas le CTA si champs vides (web oui) ; ✅ libellés distincts des placeholders.
- **Dashboard** — `3/3` versement non sécurisé (C) ; `2/3` KPI divergents natif/web (web a « cumul net », « prochain versement », sparkline) ; `2/3` « Cumul net 2025 » en dur (on est en 2026) ; `1/3` avatar→Réglages sans affordance ; `1/3` cloche web factice (sans `onClick`, pastille toujours visible).
- **Musique / Stats** — `2/3` architecture divergente (natif 1 écran + onglets / web nav latérale + sous-pages) ; `2/3` états vides bruts côté natif ; `2/3` pas de loader sur l'onglet Titres ; `1/3` cibles pastilles/onglets ~33px (< 44px).
- **Relevés** — `3/3` logique « demande de versement » + mapping de statuts incohérents (web étiquette `draft`/`pending` → « Disponible » à tort) ; `2/3` filtre année + total absents sur natif ; `2/3` natif montre royalties artiste, web montre des **bruts** → montants différents pour le même relevé.
- **Paiements** — `3/3` (C) ; `2/3` RIB jamais affiché avant la demande sur natif ; `2/3` tout versement étiqueté « Reçu » ; `1/3` écran Paiements hors tab-bar (peu découvrable).
- **Contrats + signature** — `3/3` (A, B) ; `2/3` consentement affiché comme une `Alert.alert('', …)` sans titre (confondu avec une erreur) ; `2/3` aucun lien vers le PDF du contrat avant signature ; `2/3` tag « À signer » contraste insuffisant (couleur hors palette).
- **Promo** — `2/3` tri totalement différent natif (par récence) vs web (onglets par type) ; `2/3` décision brute non traduite (« added », « pass »…) ; `1/3` ~13 métriques empilées (charge cognitive).
- **Support** — `3/3` (G) ; `2/3` support hors navigation native (via Réglages) ; `2/3` libellé du champ message = « Envoyer » (≠ rôle) ; `1/3` empty state natif non stylé.
- **Réglages** — `3/3` (F) édition profil/RIB absente sur natif ; `2/3` web sans validation IBAN ni obligatoires ; `2/3` « Artiste · Whales Records » en dur (faux en multi-tenant) ; `1/3` pastilles d'accent < 44px ; `1/3` déconnexion sans confirmation.
- **Notifications** — `3/3` (E) ; `2/3` emojis sans alternative texte (lecteur d'écran) ; `2/3` bandeau présent sur natif mais pas sur web ; `1/3` cloche web sans `aria-label`.

### Patterns transverses (artiste)
1. **Parité native ⇄ web rompue** (le plus grave) : signature (web ✗), création ticket (natif ✗), édition RIB (natif ✗), login code (web ✗), filtre années (natif ✗).
2. **Action financière non sécurisée** : versement sans confirmation/récap/erreur.
3. **Statuts & montants incohérents** entre plateformes (`artist_share`, statuts relevés, royalties vs bruts, « Reçu » générique).
4. **États vide/chargement/erreur inégaux** ; échecs silencieux (`catch {}` vides).
5. **Accessibilité** : cibles < 44px, emojis sans alternative, boutons sans `aria-label`, contrastes.
6. **i18n partielle** : textes en dur non traduits côté natif malgré le sélecteur FR/EN.

---

## ✅ Plan d'action priorisé

**Quick wins (effort faible, impact fort)**
1. Modale de **confirmation + récap** sur la demande de versement (+ `catch` courtois) — artiste C.
2. Corriger la **destination du bandeau de notifs** natif + ne marquer lu **que** la notif ouverte — artiste E.
3. **Unifier `artist_share`** (fraction vs %) entre natif et web — artiste B.
4. **Aligner le mapping des statuts** de relevés (web) — artiste (relevés 3/3).
5. Remonter le **contraste des libellés** `roy-eyebrow` ≥ AA + marquer les obligatoires — admin C.

**Chantiers structurants (fondateurs, fort levier)**
6. Refondre **`Input`/`Select`/`Modal`/`ConfirmDialog`/`Toast`/`Stepper`** partagés (admin A+B+C, + modales/steppers 2/3) et imposer leur usage.
7. **Parité artiste** : signature de contrat sur web (A), création de ticket + édition RIB sur natif (F, G), login par code sur web (D).
8. **Responsive** : vues cartes pour les tableaux à grille fixe (royalties, catalogue) ; retirer `user-scalable=no`.
9. **Harmoniser l'architecture** Musique/Stats/Promo et le jeu de KPI entre natif et web ; **multi-tenant** : remplacer « Whales Records » en dur par le label réel.
10. **i18n** : sortir les chaînes natives en dur vers le dictionnaire FR/EN.

> Méthode : audit heuristique par écran et par parcours, gravité 1→3. Prochaine
> étape recommandée du doc UX : un **test utilisateur rapide (≈5 personnes)** sur
> les 2 parcours critiques (demande de versement artiste ; création de contrat admin)
> pour valider les correctifs.
