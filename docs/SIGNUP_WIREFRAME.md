# Wireframe — Inscription d'un label (self-service)

> Basse/moyenne fidélité, en niveaux de gris, wording réel (pas de lorem).
> Principe : parcours segmenté en **petites étapes** (Hick/charge cognitive),
> **libellé + champ + placeholder distincts**, un **CTA principal** par écran,
> guidage + gestion d'erreur courtoise, **mobile ET desktop**.

## Wireflow (parcours)
```
[/signup]  Étape 1 Compte ──▶ Étape 2 Label ──▶ Étape 3 Artistes ──▶
           Étape 4 Distribution ──▶ Étape 5 Outils ──▶ Étape 6 Récap ──▶ [Confirmation]
```
Barre de progression « Étape X/6 » en haut. Bouton **Retour** à chaque étape
(loi de liberté). Brouillon conservé entre étapes (pas de perte de saisie).

---

## Étape 1 — Compte
```
┌───────────────────────────────────────────┐
│  Whales Records — Créer votre espace label │
│  Étape 1/6 · Compte                        │
│                                            │
│  E-mail professionnel *                    │
│  [ vous@votre-label.com               ]    │
│                                            │
│  Mot de passe *                            │
│  [ ••••••••••              ] (8+ car.)      │
│                                            │
│  ( ) J'ai déjà un compte → Se connecter    │
│                                            │
│              [ Continuer → ]               │
└───────────────────────────────────────────┘
```
- Validation à la saisie : e-mail valide, mot de passe ≥ 8 car. Message à côté du champ.
- Crée le compte via Supabase (ou connexion si existant) → fournit le JWT pour la suite.

## Étape 2 — Label
```
  Étape 2/6 · Votre label
  Nom du label *            [ Mon Super Label            ]
  Pays                      [ France ▾ ]
  Logo (PNG/JPG, fond clair)[  Glisser-déposer / Parcourir ]  ◻ aperçu
  Couleur d'accent          [▦ #EF7E2E]  (sélecteur)
                         [ ← Retour ]   [ Continuer → ]
```
- Le **slug** (URL/clé) est généré auto depuis le nom, affiché en petit + vérifié unique.
- Logo optionnel mais recommandé (aperçu immédiat = feedback).

## Étape 3 — Artistes
```
  Étape 3/6 · Vos artistes
  Rechercher sur Spotify    [ 🔎 Nom d'artiste...        ]
  Résultats (cliquer pour ajouter) :
   ◻ [img] Mondial Toboggan      ◻ [img] AINO
   ◻ [img] Lowswimmer            ◻ [img] ...
  Sélectionnés (3) :  [Mondial Toboggan ✕] [AINO ✕] [Lowswimmer ✕]
  + Ajouter un artiste manuellement (nom)        ⓘ
                         [ ← Retour ]   [ Continuer → ]
```
- Réutilise la recherche Spotify existante. Sélection multiple (chips retirables).
- Possibilité d'ajouter un artiste hors Spotify (nom libre).
- Étape « passable » (on peut continuer sans artiste, à ajouter plus tard).

## Étape 4 — Distribution
```
  Étape 4/6 · Distribution    (cochez ce que vous utilisez)
  Digital (streaming/téléchargement)
   ◻ Believe/TuneCore ◻ The Orchard ◻ FUGA ◻ DistroKid ◻ IDOL ◻ CD Baby …
   [ + autre…                              ]
  Physique (CD/vinyle)
   ◻ Differ-ant ◻ Socadisc ◻ Modulor ◻ PIAS ◻ L'Autre Distribution …
   [ + autre…                              ]
  Vente en ligne (D2C / marketplaces)
   ◻ Bandcamp ◻ Boutique Shopify ◻ Amazon ◻ Qobuz ◻ Beatport …
   [ + autre…                              ]
                         [ ← Retour ]   [ Continuer → ]
```
- 3 groupes clairement séparés (Gestalt). Listes pré-remplies cochables + champ « autre ».
- Tout optionnel (modifiable plus tard dans les réglages).

## Étape 5 — Outils
```
  Étape 5/6 · Outils (promo / analytics / smartlinks)
   ◻ SubmitHub ◻ Groover ◻ Spotify for Artists ◻ Chartmetric
   ◻ Linkfire ◻ Feature.fm ◻ Meta Ads …      [ + autre… ]
                         [ ← Retour ]   [ Continuer → ]
```

## Étape 6 — Récapitulatif & validation
```
  Étape 6/6 · Vérifiez et confirmez
  Label        Mon Super Label  (mon-super-label)   [Modifier]
  Logo         ◻ aperçu
  Artistes     Mondial Toboggan, AINO, Lowswimmer   [Modifier]
  Distribution Digital: Believe · Physique: Differ-ant … [Modifier]
  Outils       SubmitHub, Groover                   [Modifier]

  ⓘ Votre label sera créé puis validé par l'équipe Whales avant activation.
                  [ ← Retour ]   [ Créer mon label ]
```
- Chaque bloc éditable (lien « Modifier » → revient à l'étape).
- Message d'attente honnête (modération avant activation — pas de fausse promesse).

## Confirmation
```
  ✅ Votre label « Mon Super Label » a été créé.
  Statut : en attente de validation. Vous recevrez un e-mail à l'activation.
  En attendant : [ Compléter mon profil ]  [ Aller à l'accueil ]
```

---

## Notes d'implémentation (UX)
- **Mobile** : une étape = un écran plein ; CTA principal en **bas** (zone du pouce, Fitts) ;
  champs pleine largeur ; barre de progression collante en haut.
- **Desktop** : carte centrée ~560px ; même structure.
- **Accessibilité** : contrastes AA, libellés associés (`<label for>`), focus visible,
  erreurs annoncées près du champ (pas seulement la couleur).
- **Anti-perte** : brouillon en mémoire (localStorage) entre étapes.
- **Rapidité** : valeurs par défaut (pays, couleur d'accent = orange Whales par défaut
  modifiable), recherche Spotify avec debounce.
```
