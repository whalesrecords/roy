# Comment marche le calcul des royalties (explication ULTRA simple)

> Explication non-technique, fidèle au code réel (moteur : `app/services/calculator.py`).

## L'idée en une phrase
Tu importes les ventes (Spotify, Bandcamp…), l'app regarde le **contrat** de chaque
artiste pour savoir **quel % lui revient**, calcule sa part, regroupe tout en un
**relevé par artiste**, déduit ses **avances**, et tu paies le reste.

## Le parcours de l'argent, en 5 étapes
1. **Importer les ventes** → chaque ligne = un **montant**, un **artiste**, un **titre/album**.
2. **Trouver le bon contrat** → dans l'ordre : le **titre précis** (ISRC) → sinon
   l'**album** (UPC) → sinon **tout le catalogue** de l'artiste. Le contrat dit
   « artiste X % / label Y % » (X + Y = 100 %).
3. **Calculer la part** → `part artiste = montant × % artiste`.
4. **Regrouper par artiste** sur la période → **un relevé par artiste**.
5. **Déduire les avances** déjà versées, puis **payer** le reste.

## Exemple concret
- Spotify verse **100 €** pour *« Lumière »* de **Marie**.
- Contrat sur ce titre : **artiste 60 % / label 40 %** → Marie **60 €**, label **40 €**.
- Avance de 500 € non remboursée → les 60 € remboursent l'avance, Marie touche **0 €**,
  reste **440 €** d'avance. Sans avance → Marie reçoit **60 €**.

## Règles à connaître
- **Priorité du contrat** : titre > album > catalogue.
- **Parts par type de vente** possibles : streaming / téléchargement / physique.
- **Avances** : remboursées en priorité par les royalties (`recouped = min(royalties, solde_avance)`).
- **Statuts** d'un relevé : brouillon → calculé → verrouillé → payé.

## ⚠️ Points importants (limites actuelles du calcul)
1. **« Montant » = net du distributeur** : la commission Spotify/Believe est déjà
   déduite ; le % du contrat s'applique sur ce que tu reçois (pas le prix public).
2. **Sans contrat → 50/50 par défaut.** Mieux vaut un vrai contrat par artiste.
3. **Devises non converties** (taux = 1.0 en MVP) : ventes en $/£ prises telles quelles.
4. **Répartition par titre (contributeurs)** = **documentaire**, n'affecte pas les paiements.
5. **Nom plutôt qu'identifiant** : le calcul rattache par `artist_name`. Un nom avec
   « & » est partagé à parts égales entre les artistes nommés.

## Formules clés (référence)
| | |
|---|---|
| Part artiste | `montant × part_artiste` (part selon type de vente, sinon contrat, sinon 0.5) |
| Solde d'avance | `Σ avances (avant fin de période) − Σ recoupements` |
| Recoupement | `min(royalties artiste, solde d'avance)` |
| Net à payer | `royalties artiste − recoupement` |

Détail technique complet : `app/services/calculator.py` (`RoyaltyCalculator.calculate_run`).
