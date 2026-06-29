# Wireframe — Écran « Royalties » admin (refonte ULTRA simple)

> Objectif : qu'on comprenne d'un coup d'œil **qui touche quoi** et **quoi faire ensuite**.
> Principes UX : un parcours guidé en étapes, **une action principale par écran**, mots
> simples (pas de jargon « run / line item / lock »), tableau → **cartes sur mobile**,
> confirmations claires (plus d'`alert()`/`confirm()` natifs), montants lisibles.

## Vocabulaire (on bannit le jargon)
| Avant (technique) | Après (humain) |
|---|---|
| Royalty run | **Calcul** (d'une période) |
| Statement | **Relevé** (par artiste) |
| Line items | **Détail des ventes** |
| Lock | **Verrouiller** (figer les relevés) |
| Recoupment | **Avance déduite** |
| net_payable | **À payer** |

## Parcours (wireflow)
```
[Royalties]  Choisir la période ─▶ Calculer ─▶ Vérifier les relevés ─▶ Verrouiller ─▶ Payer
```
Une **bande d'étapes** en haut montre où on en est : Période · Calcul · Vérification · Paiement.

---

## Écran A — Accueil Royalties (état + 1 action)
```
┌──────────────────────────────────────────────────────────┐
│ Royalties                                                  │
│                                                            │
│  Calculer une nouvelle période                             │
│  Période *                                                 │
│  [ Janvier 2026         ▾ ]   (raccourcis : mois dernier)  │
│  Artistes :  ( • ) Tous    ( ) Choisir…                    │
│                                                            │
│              [ Calculer les royalties ]                    │
│                                                            │
│  Derniers calculs                                          │
│  • Déc. 2025 — 23 relevés — 4 210 € à payer — Payé ✓       │
│  • Nov. 2025 — 21 relevés — 3 980 € à payer — Verrouillé   │
└──────────────────────────────────────────────────────────┘
```
- **Une seule action principale** : « Calculer les royalties ». Défaut malin = mois dernier.
- Les calculs passés sont cliquables (rappel de l'état + reprise).

## Écran B — Résultat du calcul (relevés par artiste)
```
  Janvier 2026 · Calculé        Étape 3/4 · Vérification
  ┌── Récap ─────────────────────────────────────────────┐
  │ Ventes prises en compte : 12 480 €                    │
  │ Part artistes : 6 240 €   Part label : 6 240 €        │
  │ Avances déduites : 1 200 €   →  À PAYER : 5 040 €     │
  └───────────────────────────────────────────────────────┘
  Relevés (23)                              [ Exporter CSV ]
  ┌─────────────┬────────┬─────────┬─────────┬──────────┐
  │ Artiste     │ Ventes │ Sa part │ Avance  │ À payer  │
  ├─────────────┼────────┼─────────┼─────────┼──────────┤
  │ Marie       │  900 € │  540 €  │  −500 € │   40 €   │ ›
  │ Lowswimmer  │ 1 200 €│  720 €  │    —    │  720 €   │ ›
  │ Mondial T.  │  600 € │  360 €  │  −360 € │    0 €    │ ›
  └─────────────┴────────┴─────────┴─────────┴──────────┘
            [ ← Refaire le calcul ]   [ Verrouiller → ]
```
- **Récap en haut** = la phrase « ventes → parts → avances → à payer », en clair.
- Colonnes alignées à droite pour les montants ; **avance en négatif**, « à payer » en gras.
- Sur **mobile** : une **carte par artiste** (Artiste en titre, 4 lignes Ventes/Part/Avance/À payer).
- Ligne cliquable → détail (écran D).
- ⚠️ Mettre en évidence les **relevés « sans contrat (50/50) »** avec un petit badge « à vérifier ».

## Écran C — Choisir des artistes (si « Choisir… »)
Liste cherchable avec cases à cocher (libellé + recherche), défaut = tous cochés.
Évite la confusion : « Calcul limité à 3 artistes ».

## Écran D — Détail d'un relevé (un artiste)
```
  Marie · Janvier 2026 · Calculé
  À payer : 40 €   (Sa part 540 € − Avance déduite 500 €)
  ┌ Détail des ventes ────────────────────────────────┐
  │ Par titre / source                                 │
  │ « Lumière » (Spotify)   900 €  × 60 %  =  540 €    │
  │ …                                                  │
  └────────────────────────────────────────────────────┘
  ┌ Avances ──────────────────────────────────────────┐
  │ Solde avant : 500 €   Déduit : 500 €   Reste : 0 € │
  └────────────────────────────────────────────────────┘
```
- Montre **le calcul à la ligne** (`montant × % = part`) → l'admin comprend chaque euro.

## Écran E — Confirmations (remplacent les alert/confirm natifs)
- **Verrouiller** : modale « Verrouiller Janvier 2026 ? Les relevés ne pourront plus
  changer. » → [Annuler] [Verrouiller]. (`role="dialog"`, Échap, focus-trap.)
- **Payer** : modale avec **récap** « Marquer 23 relevés comme payés — total 5 040 € ? »
  → [Annuler] [Marquer payé]. Après : toast « Payé ✓ » + possibilité d'exporter.

---

## Ce que la refonte corrige (vs audit)
- Plus d'`alert()`/`confirm()` natifs (royalties:137,154) → modales claires + récap.
- Tableau **responsive** (cartes < md) → corrige la grille fixe non responsive.
- Libellés reliés aux champs (période, artistes), montants alignés, vocabulaire humain.
- **Compréhension** : le récap + le détail « montant × % = part » rendent le calcul transparent.

## À valider avant de coder
1. Sélecteur de période = **par mois** (le plus courant) — OK, ou besoin de dates libres ?
2. Afficher la **part label** à côté de la part artiste, ou la masquer pour épurer ?
3. Badge « sans contrat (50/50) » sur les relevés concernés — utile ?
