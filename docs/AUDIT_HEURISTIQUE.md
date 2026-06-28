# Audit heuristique UX — Whales Records (rapport complet)

> Étude d'évaluation menée selon `docs/UX_PRINCIPLES.md` (heuristiques de Nielsen /
> critères Bastien-Scapin, lois de l'UX, 12 règles d'ergonomie d'A. Boucher).
> Audit **en lecture seule** ; constats **ancrés dans le code** (chemin + ligne).
>
> **Périmètre** : web admin `frontend/src` (Next.js + Tailwind) ; expérience artiste =
> app native `mobile-artist/src` (Expo/RN) + PWA `frontend-artist/src` (Next.js).
> Non audité : `frontend/src/app/analytics/*` (hors périmètre).
>
> **Échelle de gravité** : `1/3` mineur · `2/3` important · `3/3` majeur / prioritaire.
>
> **Grille heuristique** : 1. Architecture · 2. Organisation visuelle (Gestalt) ·
> 3. Cohérence interne · 4. Conventions · 5. Bonne info au bon moment ·
> 6. Compréhension (mots > symboles) · 7. Guidage (affordance, CTA) ·
> 8. Gestion des erreurs · 9. Rapidité · 10. Liberté (retour/annulation) ·
> 11. Accessibilité · 12. Formulaires (libellé+champ+placeholder distincts) ·
> 13. Responsive/mobile · 14. Fitts (cibles ≥ 44px) / Hick.

---

## 🎯 Synthèse exécutive

**Web admin — 3 problèmes systémiques (3/3)** qui touchent presque tous les écrans :
corriger les composants partagés une seule fois règle des dizaines d'occurrences.
- **A** — Libellés non associés aux champs (`htmlFor`/`id` absents).
- **B** — 30 `alert()`/`confirm()` natifs (validation + feedback + suppressions sans undo).
- **C** — Libellé = placeholder + contraste des libellés < AA + obligatoires non signalés.

**Expérience artiste — parité native ⇄ web rompue** (un artiste ne vit pas la même
plateforme selon l'appareil) + **action financière non sécurisée** :
- Signature de contrat absente du web ; création de ticket et édition du RIB absentes
  du natif ; login par code absent du web ; filtre années des relevés absent du natif.
- Demande de versement sans confirmation ni récap (montant/RIB/délai), échec silencieux.
- `artist_share` affiché `×100` sur natif et brut sur web → un % faux d'un côté.
- Bandeau de notifs natif : renvoie toujours vers `Promo` et efface toutes les notifs au tap.

---

# PARTIE 1 — Web admin (`frontend/src`)

## Constats prioritaires 3/3 (systémiques)

### A — Labels non associés aux champs
Le composant partagé `components/ui/Input.tsx:22-26` rend le libellé (classe
`roy-eyebrow`) dans un `<label>` **sans `htmlFor`/`id`**. Surtout, la majorité des
écrans n'utilisent même pas ce composant : ils posent un `<span class="roy-eyebrow">`
ou un `<label>` au-dessus d'un `<input>`/`<select>` brut, jamais relié.
**Conséquences** : cliquer le libellé ne focus pas le champ (Fitts) ; les lecteurs
d'écran ne lisent pas le libellé associé au champ (WCAG 1.3.1 / 4.1.2 non conforme).
*Heuristiques : Accessibilité, Formulaires, Fitts.*
Occurrences : `components/ui/Input.tsx:22`, `app/login/page.tsx:67-89`,
`app/settings/page.tsx:360-495`, `components/InvoiceImportModal.tsx:452+`,
`app/inventory/page.tsx:720+`, `app/catalog/page.tsx:842+`,
`app/promo/submissions/page.tsx:130+`, et la plupart des autres formulaires.
**Reco** : générer un `id` via `useId()` dans `Input.tsx`, lier `htmlFor`/`id` ;
imposer l'usage de `Input`/`Select` partagés (supprimer les `<input>` bruts) ;
ajouter une prop `required` qui affiche un `*` rouge.

### B — 30 `alert()`/`confirm()` natifs
Servent à la fois de validation, feedback et confirmation destructrice. Hors charte
(non brandés, non responsive, bloquants), sans `aria-live`, **sans annulation (undo)**,
message générique loin du champ fautif. *Heuristiques : Gestion d'erreurs, Cohérence,
Liberté, Accessibilité.*
- Validation : `contracts/page.tsx:407,412`.
- Suppressions sans confirmation custom : `inventory/page.tsx:199`,
  `contracts/page.tsx:451`, `catalog/page.tsx:728,755`, `imports/page.tsx:149`,
  `tickets/[id]/page.tsx:111`, `FinancesTab.tsx:186,209`, `royalties/page.tsx:137,154`,
  `AssetsTab.tsx:155`, `ContractsTab.tsx:180`.
- Feedback succès : `FinancesTab.tsx:255`, `CatalogSection.tsx:976`.
**Reco** : créer `<ConfirmDialog>` (Échap + clic-dehors + focus-trap + `role="dialog"`)
et un système de toasts / erreurs inline ; remplacer les 30 appels. Pour les
suppressions, préférer un **undo** (toast 5-10 s) à une simple confirmation.

### C — Libellé = placeholder, contraste insuffisant, requis non signalé
Quand un libellé existe, il est en `roy-eyebrow` : mono, MAJUSCULES, 9,5px, couleur
`--text-3` (`#8A919B` clair) ≈ contraste **2,9:1** sur fond clair, **sous le seuil
WCAG AA 4,5:1**. Souvent le seul repère réel est le placeholder gris (`text-ink-faint`),
qui disparaît à la saisie. *Heuristiques : Formulaires, Accessibilité, Compréhension.*
Exemples : ajout de titre `catalog/page.tsx:770-791` (« Titre * » en placeholder),
`ManualPromoForm.tsx:133,148-150`, recherche artistes `artists/page.tsx:144-150`,
modale contributeurs `ContractContributorsModal.tsx:140-159`.
**Reco** : remonter le libellé à ≥ 11px / couleur `--text-2` (ou `--text`) pour
repasser AA ; garder libellé **et** placeholder distincts (placeholder = exemple de
format, jamais le nom du champ).

## Layout / navigation globale
`app/layout.tsx`, `components/layout/AppShell.tsx`, `components/layout/Sidebar.tsx`
- **2/3** — Zoom utilisateur désactivé : `layout.tsx:51` `maximum-scale=1, user-scalable=no` (WCAG 1.4.4). *Reco : retirer.*
- **2/3** — Bascule thème + pastilles d'accent < 44px : `Sidebar.tsx:219-227` (rangée `py-1.5` ≈ 28px ; pastilles `w-3.5 h-3.5` = 14px). *Reco : ≥ 24px de zone cliquable.*
- **1/3** — `IconLogout` (sortie) utilisée pour « Se connecter » : `login/page.tsx:100`.
- **1/3** — Identité en dur « Label Manager » : `Sidebar.tsx:244`.
- **1/3** — Mélange SVG inline (soleil/lune l.222-225) vs jeu `IconX` (cohérence d'icônes).

## Login — `app/login/page.tsx`
- **3/3** (cf. A/C) — libellés `Eyebrow` non associés (l.67-89), pas de `htmlFor`.
- **2/3** — Erreur sans `aria-live` ni focus : bandeau l.58-64. *Reco : `role="alert" aria-live="polite"`.*
- **1/3** — Pas de bouton afficher/masquer le mot de passe (l.81-88).
- **1/3** — Pas de lien « Mot de passe oublié ».

## Signup — `app/signup/page.tsx`
✅ **Point fort** : parcours bien segmenté en 6 étapes avec barre de progression
(l.166-175) et `htmlFor`/`id` corrects à l'étape 1 — **modèle à généraliser**.
- **2/3** — Validation en toast global, pas sous le champ : « 8 caractères min » (l.75) en toast (l.177-179).
- **2/3** — Message de confirmation e-mail confus (l.86). *Reco : reformuler + « Renvoyer le lien ».*
- **2/3** — Regex e-mail trop permissive `/^\S+@\S+\.\S+$/` (l.74).
- **1/3** — `input[type=file]` (logo) et `type=color` (accent) sans libellé associé (l.213,219).

## Tableau de bord — `app/page.tsx`
- **2/3** — KPI « Marge nette » ambigu (montant ou %?) : l.528-535. *Reco : suffixer l'unité.*
- **1/3** — Pas d'état vide guidant (KPI à zéro sans message/CTA).
- **1/3** — « Revenus vs Dépenses » (l.216) suggère une opposition. *Reco : « Revenus et dépenses ».*
- **1/3** — Lignes d'imports récents non cliquables (l.260-274).

## Artistes — `app/artists/page.tsx`, `app/artists/[id]/page.tsx`, `components/artist/tabs/*`
- **3/3** (cf. A) — recherche sans libellé (`artists/page.tsx:144-150`) ; champs des onglets sans `htmlFor`.
- **2/3** — Fusion d'artistes (destructrice) sans confirmation custom ni undo (l.230-238) ; modale sans Échap/focus-trap (l.261-267).
- **2/3** — Onglets non sémantiques (`[id]/page.tsx:229-244`) : `<button>` sans `role="tab"`/`tablist`/`aria-selected` ; risque de débordement horizontal mobile.
- **2/3** — Modales édition (photo/artiste) sans fermeture clavier (Échap) ni `aria-modal` (`OverviewTab.tsx:281,324` ; `AccessTab.tsx:122-134`).
- **1/3** — Bouton « Activer » sans état de chargement (l.376-384).
- **1/3** — Modale suppression : « tapez le nom » sans `htmlFor`/`id` (`OverviewTab.tsx:374-376`).

## Contrats — `app/contracts/page.tsx`, `components/contracts/ContractContributorsModal.tsx`, `ContractsTab.tsx`
- **3/3** (cf. B) — `alert()` validation (l.407,412), `confirm()` suppression (l.451) et synchro dates (l.708).
- **2/3** — Logique dates bidirectionnelle opaque (l.1237-1267) : « fin » ↔ « durée » sans champ source/calculé indiqué. *Reco : « (calculé automatiquement) ».*
- **2/3** — Répartition des parts : total validé seulement au clic (pas en temps réel), pas de `max=100` (l.1289-1291,1390).
- **2/3** — Contributeurs : 3 champs (nom/rôle/%) sans libellé (`ContractContributorsModal.tsx:140-159`).
- **2/3** — « Artiste principal » requis non signalé visuellement (l.1067).
- **1/3** — Incohérence libellé « Synchro dates de fin » (l.838) vs « dates de début » (l.700-708).
- **1/3** — Coquilles d'accents dans les `alert` : « a rafraichir », « mis a jour », « date de debut » (l.681,688,708).

## Finances — `app/finances/page.tsx`, `components/InvoiceImportModal.tsx`
- **3/3** (cf. A) — libellés `roy-eyebrow` sans `htmlFor` (dépense l.604,618 ; export l.844-889 ; import l.452+).
- **2/3** — Suppression de dépense en état inline fragile (Confirmer/Annuler l.750-772) : état perdu à la navigation, pas d'avertissement d'irréversibilité.
- **2/3** — Erreurs au niveau page, pas du champ (bandeau l.518-522) alors que `Input` a un slot `error`.
- **2/3** — `InvoiceImportModal` sans indicateur d'étapes (états `upload|preview|done` l.118 ; titre seul l.329) et **fermeture sans garde-fou** pendant extraction/création (l.310-319) → perte de données.
- **2/3** — Rechargement albums/tracks au changement de scope/artiste sans loader clair (select vide, l.542-602).
- **1/3** — Champ montant sans symbole € ni placeholder `0.00` (l.1034-1040) ; confiance OCR colorée sans texte « Vérifiez » (l.415-419).

## Royalties — `app/royalties/page.tsx`
- **3/3** (cf. B) — `confirm()` paiement en masse (l.137) et action verrouillée (l.154), coquille « verrouille ».
- **2/3** — Tableau non responsive : grille fixe `grid-cols-[1.8fr_1.1fr_0.8fr_1.1fr_1fr]` (l.341-373) → débordement mobile, nombres non alignés à droite. *Reco : vue cartes < md.*
- **1/3** — Labels export « Début »/« Fin » sans contexte (l.396,405) ; pas de feedback de téléchargement.

## Inventaire — `app/inventory/page.tsx`, `app/inventory/AssetsTab.tsx`
- **3/3** (cf. A/C) — formulaire produit (l.720+) et immobilisations (`AssetsTab.tsx:435+`) : libellés non liés, placeholder en guise de libellé, requis non indiqué.
- **2/3** — `confirm()` suppression produit (l.199) / immobilisation (`AssetsTab.tsx:155`).
- **2/3** — Import Reverb jargonneux (`AssetsTab.tsx:606-608`, `owner_cost` sans exemple) ; « Fichier CSV » ambigu vs « Reverb CSV ».
- **1/3** — Upload CSV sans affordance drag-and-drop explicite (l.1017-1040) ; champ « Raison » optionnel non signalé (l.964).

## Catalogue — `app/catalog/page.tsx`, `app/catalog/[artist]/page.tsx`
- **3/3** (cf. C) — ajout de titre inline : 3 champs sans libellé, « Titre * » en placeholder (l.770-791) ; modale album : libellé via placeholder (l.842-849).
- **2/3** — Modale « lier artistes » (répartition %) : guidage confus, total 100% validé seulement au clic (l.950-1016,986-993). *Reco : valider au blur, total en rouge si ≠ 100%.*
- **2/3** — `confirm()` suppression album/track (l.728,755) ; modale fusion débordable mobile (l.284-313).
- ✅ La page `[artist]/page.tsx` (consultation) ne pose pas de problème majeur.

## Imports (ventes) — `app/imports/page.tsx`, `components/imports/*`
✅ **Point fort** : `MappingStep.tsx` a un fil d'Ariane d'étapes propre (l.138-154) — modèle à réutiliser.
- **2/3** — Flux global non numéroté : `UploadFlow.tsx` upload → artistes → done sans « Étape 2/3 » (l.307-379) ; écran final sans retour `/imports` (l.239-282, seulement « Fermer »).
- **2/3** — `MappingStep` : champs cible non marqués requis/optionnels, liste 10+ options à plat sans `<optgroup>` (l.164-234,206-210) ; pas d'état d'erreur si l'aperçu ne charge pas (l.110-119, loading infini).
- **2/3** — `EmptyState.tsx:8-27` (et `imports/page.tsx:196-197`) sans CTA : l'utilisateur doit remonter en haut. *Reco : « Importer maintenant ».*
- **2/3** — `confirm()` suppression d'import (l.149).
- **1/3** — Doublon détecté peu visible (`UploadFlow.tsx:489-508`) ; affordance DnD discrète au repos.

## Promo — `app/promo/*`, `components/promo/*`
- **2/3** — Trois flux d'upload incohérents : Groover bloque sur artiste non reconnu (`GrooverUploadFlow.tsx:239`) ; SubmitHub ne le fait pas (`SubmitHubUploadFlow.tsx:244+`) ; SpotifyAds **sans étape preview** (`SpotifyAdsUploadFlow.tsx:126-142`). *Reco : harmoniser.*
- **2/3** — `ManualPromoForm` : libellés = placeholders (l.133,148-150), erreur en bas du formulaire (l.177-180).
- **2/3** — Filtres `promo/submissions` sans libellé associé (l.130,177-212), requis non indiqué.
- **1/3** — `Retour` réinitialise tout sans confirmation (`GrooverUploadFlow.tsx:328`) → perte des saisies.
- **1/3** — Texte anglais résiduel « No SubmitHub data » (`promo/stats:226`).

## Suggestions Spotify — `app/spotify-suggestions/page.tsx`
- **2/3** — « Ajouter »/« Ignorer » sans confirmation ni undo (l.313-330, API directe l.119-149). *Reco : toast undo.*
- **1/3** — État approuvé/rejeté peu lisible (`opacity-70`, l.220-224). *Reco : badge explicite.*

## Tickets — `app/tickets/page.tsx`, `tickets/new/page.tsx`, `tickets/[id]/page.tsx`
- **2/3** — Filtres/recherche sans libellé ni `aria-label` (`tickets/page.tsx:137-142`).
- **2/3** — `tickets/new` mélange composants (HeroUI `Input`/`Textarea` sans label/error l.195-210 + `labelClass` séparé + erreur loin du champ l.117-120). *Reco : `Input` unifié.*
- **2/3** — Détail : pas de feedback après envoi (l.67-83) ; « Note interne » peu visible (case, l.309-315) → risque d'envoyer une note censée privée. *Reco : badge « 🔒 Invisible pour l'artiste ».*
- **1/3** — `confirm()` suppression ticket (l.111) ; changement de statut sans confirmation (l.86-95).

## Synthèse transverse (admin)
| Thème | Gravité | Portée |
|-------|---------|--------|
| A — Libellés non associés + `Input` non généralisé | 3/3 | ~tous les formulaires |
| B — 30 `alert()`/`confirm()` natifs | 3/3 | 14 fichiers |
| C — Libellé = placeholder + contraste < AA + requis non signalé | 3/3 | ~tous les formulaires |
| Modales sans Échap/focus-trap/`aria-modal` | 2/3 | artistes, catalogue, contrib., import factures |
| Onglets sans `role="tab"` | 2/3 | fiche artiste |
| Tableaux non responsive (grilles fixes) | 2/3 | royalties, catalogue |
| Flux multi-étapes non numérotés | 2/3 | imports, factures, promo |
| 3 flux d'upload promo incohérents | 2/3 | promo |
| Cibles tactiles < 44px | 1-2/3 | sidebar, listes, modales |
| Coquilles/accents FR | 1/3 | contrats, finances, royalties, settings |
| `user-scalable=no` | 2/3 | global |

**Effet de levier** : 3 chantiers fondateurs neutralisent l'essentiel —
(1) refondre `Input`/`Select` (id auto + `htmlFor` + `required *` + contraste AA) et
imposer leur usage ; (2) `<ConfirmDialog>` + toasts/erreurs inline → remplacer les 30
`alert/confirm` ; (3) composant `Modal` accessible + `Stepper` réutilisable (déjà dans
`MappingStep`).

---

# PARTIE 2 — Expérience artiste (`mobile-artist/src` + `frontend-artist/src`)

## Constats prioritaires 3/3
| # | Écran | Constat | Heur. |
|---|-------|---------|-------|
| A | Contrats (web) | PWA **lecture seule** : aucun pavé de signature ni route `ContractSign` (le natif a `ContractSignScreen.tsx`). Artiste 100% web **ne peut pas signer**. | 1,3,7 |
| B | Contrats (×plateforme) | `artist_share` : natif `Math.round(c.artist_share*100)`, web `{contract.artist_share}%` brut → **% faux d'un côté** (ex. 50% vs 5000%). | 3,8 |
| C | Paiement | `requestPayment(unpaid[0].id)` **sans confirmation ni récap** (montant/RIB/délai) ; natif `handleRequest` **sans `catch`** → échec silencieux. | 7,8,10 |
| D | Login | Natif = code d'accès **ou** e-mail ; web = e-mail seul → artiste avec *code* bloqué sur PWA. | 1,3,4 |
| E | Notifs accueil (natif) | `DashboardScreen.tsx:142` : destination **toujours `Promo`** (`...includes('promo') ? 'Promo' : 'Promo'`) ; `markAllNotificationsRead()` **purge tout** au tap. | 5,7,10 |
| F | Réglages (natif) | **Édition profil/RIB absente** : aucun champ IBAN/BIC sur natif (le web a le formulaire complet). Artiste 100% mobile ne peut jamais renseigner son IBAN → versement SEPA impossible. | 1,3,12 |
| G | Support (natif) | **Création de ticket impossible** (consultation/réponse seules ; le web a une bottom-sheet de création). | 1,7 |

## Login — `mobile-artist/src/screens/LoginScreen.tsx`, `frontend-artist/src/app/login/page.tsx`
- **3/3** (D) — modes d'auth divergents. *Reco : aligner (ajouter le mode « code » sur le web, ou retirer partout s'il est déprécié).*
- **2/3** — Message d'erreur générique (natif « Identifiants invalides » / web « Email ou mot de passe incorrect ») ; recours « contactez votre label » présent sur web (l.93-95) mais **absent du natif**.
- **2/3** — Champs requis non indiqués ; le natif ne désactive pas le CTA si champs vides (le web le fait).
- **1/3** — ✅ Libellés distincts des placeholders (`XXXX-XXXX`, `vous@exemple.com`) — conforme.
- **1/3** — Contraste placeholder `p.text3` faible (acceptable car exemple).

## Dashboard — `mobile-artist/src/screens/DashboardScreen.tsx`, `frontend-artist/src/app/(app)/page.tsx`
- **3/3** (C) — `handleRequest` sans confirmation ; toast de succès dans le `try`, donc en cas d'échec **rien ne s'affiche** (échec silencieux).
- **2/3** — Bandeau notifs : texte ambigu « `${notifs.length} nouveauté(s) — appuyez pour voir` » (singulier/pluriel via « (s) ») ; cible toujours Promo (E).
- **2/3** — KPI divergents : le web a « Cumul net 2025 », « Prochain versement », sparkline + détail `pendingValidation` ; le natif n'a aucun des trois.
- **2/3** — « Cumul net 2025 » en dur (`page.tsx:232`) alors qu'on est en 2026.
- **1/3** — Avatar = accès Réglages sans affordance (natif) ; le web a une icône engrenage distincte.
- **1/3** — Cloche web factice (l.145-150) : `<button>` **sans `onClick`**, pastille « non lu » toujours visible (le vrai bell est `NotificationBell`).

## Musique / Stats — `MusicScreen.tsx`, `StatsScreen.tsx` ; `frontend-artist/src/app/(app)/{musique,stats,tracks,releases}`
- **2/3** — Architecture divergente : natif = 1 écran Musique (onglets Titres/Sorties) + Stats en tab-bar ; web = nav latérale Stats **et** Musique distincts + sous-pages `/tracks`, `/releases`.
- **2/3** — États vides incohérents et non stylés sur natif (simples `<Text>` gris) vs jolis empty states web.
- **2/3** — Pas de loader sur l'onglet Titres (`StatsScreen` l.179 : `loading && view !== 'titres'`).
- **1/3** — Pastilles d'année ~33px (`StatsScreen` l.162) et onglets segmentés ~33px (Music l.50) < 44px.

## Relevés — `StatementsScreen.tsx` ; `frontend-artist/src/app/(app)/statements/page.tsx`
- **3/3** — Logique « demande de versement » incohérente : web `status === 'published' && net>0`, natif `status !== 'paid'`. Statuts divergents : natif connaît `approved/ready/pending_payment/pending/draft`, web ne gère que `paid/draft` et **tout le reste devient « Disponible »** (l.16-20) → un `draft`/`pending` étiqueté « Disponible » à tort.
- **2/3** — Filtre par année + total « Net perçu » + export CSV présents sur web, **absents sur natif**.
- **2/3** — Détail : natif « Par source » avec `artist_royalties`, web « Par plateforme » avec `r.gross`/`src.gross` (bruts) → **montants différents pour le même relevé**.
- **1/3** — Détail indisponible : ton correct mais pas de bouton « réessayer ».

## Paiements — `PaymentsScreen.tsx` ; `frontend-artist/src/app/(app)/payments/page.tsx`, `payments/[id]/page.tsx`
- **3/3** (C).
- **2/3** — RIB jamais affiché avant la demande sur natif (le web montre une carte « Compte SEPA » avec IBAN masqué + Modifier).
- **2/3** — Tout versement étiqueté « Reçu » (web) ; un versement « demandé/en cours » n'est pas reçu → fausse info.
- **1/3** — Écran Paiements hors tab-bar (accessible via Réglages) → peu découvrable.
- **1/3** — Pluriel « versement(s) » non i18n (toujours FR).

## Contrats + signature — `ContractsScreen.tsx`, `ContractSignScreen.tsx` ; `frontend-artist/src/app/(app)/contracts/page.tsx`
- **3/3** (A, B).
- **2/3** — Consentement obligatoire affiché via `Alert.alert('', t('contracts.consent'))` → **alerte sans titre** (confondue avec une erreur). *Reco : « Cochez la case de consentement pour signer ».*
- **2/3** — Aucun lien vers le `document_url`/PDF avant signature (on signe sans pouvoir tout lire).
- **2/3** — Tag « À signer » : texte `#C9982B` sur fond `rgba(227,179,65,0.16)` → contraste insuffisant + couleur en dur hors palette.
- **1/3** — Une fois signé, état figé sans lien pour revoir/télécharger le certificat.

## Promo — `PromoScreen.tsx` ; `frontend-artist/src/app/(app)/promo/page.tsx`
- **2/3** — Modèles mentaux différents : natif par récence (≤ 1 mois / dossier ancien) ; web par onglets Playlists / Articles & médias / Retours positifs.
- **2/3** — Décision brute non traduite : natif `s.decision || s.action || '—'` souvent en anglais (« added », « pass »).
- **1/3** — « → » séparateur de période (OK) ; `AdCard` empile ~13 métriques (charge cognitive, atténuée par « Voir tous les résultats »).

## Support — `SupportScreen.tsx` ; `frontend-artist/src/app/(app)/support/page.tsx`, `support/[id]/page.tsx`
- **3/3** (G) — création de ticket impossible sur natif.
- **2/3** — Support hors navigation native (via Réglages) ; sur web en bottom-nav avec badge non-lus.
- **2/3** — Web : champ message porte le `<label>` « Envoyer » (= `t('support.send')`), pas « Votre message » (l.264).
- **1/3** — Pas de rafraîchissement auto des tickets sur natif (juste pull-to-refresh).
- **1/3** — Empty state natif non stylé.

## Réglages — `SettingsScreen.tsx` ; `frontend-artist/src/app/(app)/settings/page.tsx`
- **3/3** (F) — édition profil/RIB absente du natif (IBAN/BIC indispensables au versement SEPA).
- **2/3** — Web : pas d'obligatoire ni validation IBAN/BIC près du champ ; erreurs en haut de page (`FieldInput` l.12-27).
- **2/3** — « Artiste · Whales Records » en dur (natif l.30) alors que le web montre `label?.label_name` → faux en multi-tenant.
- **1/3** — Pastilles d'accent 32px (natif)/36px (web) < 44px.
- **1/3** — Déconnexion sans confirmation.

## Notifications (bandeau + cloche) — `DashboardScreen.tsx:137-162`, `frontend-artist/src/components/layout/NotificationBell.tsx`
- **3/3** (E) — destination toujours Promo + purge totale au tap.
- **2/3** — Emojis (💰📊💬🎵📢🔔) sans alternative texte (lecteur d'écran). *Reco : SVG + `aria-label`.*
- **2/3** — Bandeau pleine largeur sur natif mais absent du web (cloche/dropdown seulement).
- **1/3** — Cloche web : `<button>` sans `aria-label` (l.118).

## Synthèse transverse (artiste)
1. **Parité native ⇄ web rompue** (le plus grave) : signature (web ✗), création ticket (natif ✗), édition RIB (natif ✗), login code (web ✗), filtre années relevés (natif ✗).
2. **Action financière non sécurisée** : versement sans confirmation/récap/erreur (3 écrans).
3. **Statuts & montants incohérents** : `artist_share` (fraction vs %), statuts relevés mal mappés (web), royalties vs bruts, « Reçu » générique.
4. **États (vide/chargement/erreur) inégaux** ; échecs silencieux (`catch {}` vides).
5. **Accessibilité** : cibles < 44px, emojis sans alternative, boutons sans `aria-label`, contrastes (tag « À signer », placeholders).
6. **i18n partielle** : textes natifs en dur (« Total versé », « versement(s) », « Aucun relevé », « Artiste · Whales Records ») malgré le sélecteur FR/EN.

Fichiers clés : `mobile-artist/src/screens/{DashboardScreen,ContractsScreen,ContractSignScreen,PaymentsScreen,SupportScreen,SettingsScreen,StatementsScreen}.tsx` ·
`frontend-artist/src/app/(app)/{page,contracts/page,payments/page,statements/page,settings/page,support/page,promo/page}.tsx` ·
`frontend-artist/src/components/layout/{NotificationBell,BottomNav,ArtistSidebar,AppHeader}.tsx` · `mobile-artist/src/i18n/index.tsx`.

---

# Plan d'action priorisé

### Quick wins (effort faible, impact fort)
1. **Sécuriser la demande de versement** : modale confirmation + récap (montant/RIB) + `catch` courtois — *artiste C*.
2. **Corriger le bandeau de notifs natif** : router selon le type + ne marquer lu que la notif ouverte — *artiste E*.
3. **Unifier `artist_share`** (fraction vs %) entre natif et web — *artiste B*.
4. **Aligner le mapping des statuts** de relevés côté web — *artiste (relevés 3/3)*.
5. **Contraste des libellés** `roy-eyebrow` ≥ AA + marquer les obligatoires — *admin C*.

### Chantiers structurants (fort levier)
6. Refondre les **composants partagés** `Input`/`Select`/`Modal`/`ConfirmDialog`/`Toast`/`Stepper` (admin A+B+C + modales/steppers 2/3) et **imposer leur usage**.
7. **Parité artiste** : signature de contrat sur web (A) ; création de ticket + édition RIB sur natif (F, G) ; login par code sur web (D).
8. **Responsive** : vues cartes pour les tableaux à grille fixe (royalties, catalogue) ; retirer `user-scalable=no`.
9. **Harmoniser l'architecture** Musique/Stats/Promo et le jeu de KPI natif/web ; **multi-tenant** : remplacer « Whales Records » en dur par le label réel.
10. **i18n** : sortir les chaînes natives en dur vers le dictionnaire FR/EN.

> Prochaine étape recommandée par `UX_PRINCIPLES.md` : un **test utilisateur rapide
> (≈ 5 personnes ≈ 85% des problèmes)** sur les 2 parcours critiques — *demande de
> versement (artiste)* et *création de contrat (admin)* — pour valider les correctifs.
