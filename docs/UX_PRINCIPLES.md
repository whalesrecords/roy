# Principes UX / ergonomie à appliquer

Quand on conçoit ou modifie une interface, une app ou un site, appliquer par défaut
les principes ci-dessous (conception centrée utilisateur — heuristiques de Nielsen,
lois de l'UX, 12 règles d'ergonomie d'Amélie Boucher). En cas de doute, privilégier
la clarté et la simplicité pour l'utilisateur.

## Checklist de conception (12 règles)
1. **Architecture** : contenus organisés logiquement (arborescence claire).
2. **Organisation visuelle** : grouper le lié, espacer le non-lié (Gestalt, Hick).
3. **Cohérence interne** : même chose = même apparence partout.
4. **Conventions web** : logo cliquable haut-gauche, menu en haut, panier haut-droite, mots familiers ("Accueil", "Contact").
5. **Information** : donner la bonne info au bon moment (utilité globale + micro-utilités).
6. **Compréhension** : préférer les mots aux symboles, vocabulaire orienté utilisateur.
7. **Guidage** : organisation, affordance et CTA accompagnent l'utilisateur.
8. **Gestion des erreurs** : prévenir l'erreur, puis aider à la corriger (jamais culpabiliser).
9. **Rapidité** : navigation efficiente, éviter les actions inutiles.
10. **Liberté** : laisser le contrôle, ne pas forcer (retour arrière, annulation possibles).
11. **Accessibilité** : contrastes suffisants, texte lisible, alternatives aux symboles.
12. **Satisfaction** : objectif final = l'utilisateur atteint son but agréablement.

## Lois psycho à respecter dans l'UI
- **Gestalt** : proximité, similarité (même style = même fonction), point focal unique, continuité, symétrie. Utiliser les espaces blancs comme outil de lecture.
- **Loi de Fitts** : cibles cliquables assez grandes et proches ; la zone cliquable doit dépasser le libellé ; espacer les actions distinctes. Sur mobile, prioriser le bas/centre (zone du pouce).
- **Miller (≤7 items) + Hick** : limiter les choix, regrouper, proposer un défaut pertinent pour accélérer la décision.
- **Affordance** : un élément doit suggérer son usage. Souligné = lien uniquement. Hiérarchie visuelle nette entre action principale et secondaire.
- **Von Restorff / serial position** : éléments importants en début/fin de liste, ou différenciés visuellement (ex. offre "recommandée").
- **Biais cognitifs** : éviter les dark patterns (urgence/rareté manipulatrices). Segmenter les parcours longs en petites étapes.

## Formulaires (très important)
- Toujours : **libellé + champ + placeholder distincts**. Ne JAMAIS remplacer le libellé par le placeholder.
- Indiquer les champs obligatoires, donner des indications (format attendu).
- Taille du champ = taille de l'info demandée.
- Validation et message d'erreur dès la saisie, à côté du champ concerné, avec ton courtois.

## Contenu & visuel
- UX writing : langage simple et concis, microcopy utile.
- Travailler avec de vrais contenus (pas de lorem ipsum).
- Typo : ≤3 polices, ferrage à gauche, 10-15 mots par ligne, contrastes vérifiés.
- Couleurs : règle 60-30-10 (primaire / secondaire / accentuation). Ne pas véhiculer une info par la couleur seule.
- Responsive avec grille. Design émotionnel léger (cohérence de marque) bienvenu.

## Création de wireframes (à faire avant tout design)
Quand on conçoit une app/page, passer par une phase de wireframe AVANT le design graphique.
- Progression : **zoning** (blocs/zones, basse fidélité) → **wireframe** (contenus, hiérarchie, interactions, moyenne fidélité) → **maquette haute-fidélité** → prototype.
- Rester en niveaux de gris, pas de graphisme : se concentrer sur structure, fonctionnalités, responsive, titres et wording réels (pas de lorem ipsum).
- Utiliser des dimensions réelles, annoter les propositions, penser desktop ET mobile.
- Proposer plusieurs variantes d'écran rapidement (esprit Crazy 8 / 6-to-1) puis converger vers la meilleure.
- Wireframer chaque écran clé du parcours et relier les écrans (wireflow) pour montrer la navigation.
- But : itérer vite et prendre de meilleures décisions sur l'expérience avant d'investir dans le visuel/code.

## Boîte à outils UX (méthodes à mobiliser selon le besoin)
- **Recherche / besoin** : entretien semi-directif (questions ouvertes "Parlez-moi de…", "Montrez-moi…", "Qu'est-ce qui vous gêne ?"), observation, questionnaire en complément.
- **Définir le vrai problème** : méthode des **5 pourquoi**, reformulation "Comment pourrions-nous… ?".
- **Cibler** : **persona** (besoins, objectifs, contexte, frustrations, matériel, scénario) ; **carte d'empathie** (Says / Thinks / Does / Feels).
- **Parcours** : **carte d'expérience** (persona + objectif, phases, actions, émotions/points de friction, opportunités, points de contact).
- **Idéation** : brainstorming + diagramme d'affinité, Crazy 8.
- **Évaluation** : **audit heuristique** — grille Nielsen / Bastien-Scapin, gravité par problème (1/3 mineur, 2/3 important, 3/3 majeur prioritaire) par écran et par parcours.

## Avant de livrer une UI
- Vérifier mentalement le parcours utilisateur principal de bout en bout.
- Proposer/penser un test rapide (5 utilisateurs ≈ 85% des problèmes d'un parcours).
- Passer un mini audit heuristique : organisation, cohérence, guidage, gestion des erreurs, accessibilité, rapidité.
