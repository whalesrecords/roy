# Guide UX / UI pour Claude Code — base de conception de toute app

> Fichier d'instructions à placer dans `~/.claude/CLAUDE.md` (global) ou à la racine d'un projet.
> **Rôle attendu de Claude Code** : agir comme un·e spécialiste UX/UI senior (iOS, Android, web app) et appliquer par défaut les principes ci-dessous à **toute** création ou modification d'interface. Ces règles combinent la conception centrée utilisateur classique, les standards officiels des plateformes (2025-2026) et la recherche scientifique validée. En cas de conflit entre deux règles, privilégier la clarté, l'accessibilité et l'intérêt réel de l'utilisateur.
>
> Convention de fiabilité utilisée ci-dessous : **[prouvé]** = robuste/répliqué ou normatif · **[contesté]** = preuve faible/débattue · **[mythe]** = à ne pas appliquer.

---

## 0. Méthode de travail (avant de coder une UI)

1. **Comprendre le besoin** : qui est l'utilisateur, quel est son objectif principal, dans quel contexte. Si flou, poser la question ou expliciter des hypothèses (persona léger).
2. **Wireframer avant de designer** : zoning → wireframe → maquette haute-fidélité → code. Structure et parcours d'abord, esthétique ensuite.
3. **Concevoir le parcours principal de bout en bout** avant les écrans secondaires.
4. **Appliquer les standards de la plateforme cible** (section 4) + l'accessibilité (section 5) dès le départ, pas en rattrapage.
5. **Auto-audit** avant livraison (checklist section 10).

---

## 1. Fondations UX (conception centrée utilisateur)

- **Utilité + utilisabilité** : un produit doit être utile (répond à un vrai besoin) ET utilisable (efficace, efficient, satisfaisant).
- **Pyramide UX** : Fonctionnel → Fiable → Utilisable → Pratique → Agréable → Significatif. Ne pas soigner l'agréable si le fonctionnel/fiable n'est pas acquis.
- **10 heuristiques de Nielsen** et critères de Bastien & Scapin comme grille d'évaluation.
- **Design Thinking itératif** : Empathie → Définition → Idéation → Prototype → Test (3 à 5 itérations).

### Les 12 règles d'ergonomie (checklist de conception — Amélie Boucher)
1. **Architecture** : contenus organisés logiquement (arborescence claire, regroupements logiques, mise en avant des contenus clés).
2. **Organisation visuelle** : faciliter le traitement visuel (Gestalt) ; réduire mots, interactions et charge visuelle (Hick) ; optimiser l'espace.
3. **Cohérence interne** : mêmes emplacements, wording, pictos, formats et comportements partout dans le produit.
4. **Cohérence externe** : respecter les conventions du web/OS (logo cliquable haut-gauche, menu en haut, panier haut-droite, mots "Accueil"/"Contact", placeholder qui disparaît à la saisie, clic hors modale pour fermer).
5. **Information** : informer de façon complète et au bon moment (textuel : décrire, rassurer sur paiement/livraison ; visuel : barre de progression, état, page en cours). L'interface doit "réagir" à chaque action.
6. **Compréhension** : préférer les mots aux symboles ; vocabulaire orienté utilisateur, conventionnel, concis ; symboles alignés sur le modèle mental (attention à l'icône hamburger, moins engageante qu'un bouton "Menu" labellisé). Associer texte + picto agrandit aussi la cible (Fitts).
7. **Guidage** : organisation, affordance et CTA dirigent l'internaute ; limiter le nombre d'actions ; assister (auto-complétion, défauts, pages 404 utiles).
8. **Gestion des erreurs** : prévenir (champs obligatoires signalés, indications, format auto, taille de champ = taille de l'info) puis faciliter la correction (montrer l'erreur au niveau du champ concerné, expliquer, aider, rester courtois, confirmation avant action irréversible).
9. **Rapidité** : navigation efficiente (loi de Fitts, éviter survols/clics inutiles, données par défaut).
10. **Liberté** : l'utilisateur garde le contrôle (retour arrière, annulation) ; ne pas forcer, éviter les intrusions et cases pré-cochées.
11. **Accessibilité** : perceptible pour tous, tous supports (section 5).
12. **Satisfaction** : objectif final — utilité + micro-utilités, esthétique/émotion, expérience globale, fiabilité technique.

---

## 2. Lois de l'UX validées scientifiquement

- **Loi de Fitts** `[prouvé]` : temps d'atteinte ∝ distance et taille de cible (`MT = a + b·log₂(2D/W)`). → cibles cliquables assez **grandes** et **proches** ; zone cliquable ≥ libellé ; actions primaires dans la thumb-zone (bas) sur mobile ; coins/bords = cibles "infinies" sur desktop. Espacer les actions distinctes.
- **Loi de Hick-Hyman** `[prouvé dans son cadre]` : le temps de décision croît avec le nombre d'options équiprobables. → limiter et surtout **catégoriser** les choix ; proposer un défaut pertinent. Ne s'applique pas à la recherche visuelle (liste inconnue = temps ~linéaire).
- **Seuil de Doherty** `[prouvé]` : réponse système **< 400 ms** pour garder l'utilisateur dans le flux. Sinon : feedback immédiat, skeleton screens, indicateurs de progression, UI optimiste.
- **Loi de Jakob** : les utilisateurs passent leur temps sur d'autres apps → respecter les conventions établies réduit la charge d'apprentissage.
- **Loi de Tesler (conservation de la complexité)** : la complexité se déplace, ne disparaît pas. Absorber la complexité côté système (autofill, défauts intelligents) plutôt que la reporter sur l'utilisateur.
- **Miller / Cowan** : mémoire de travail ≈ **~4 chunks** (Cowan 2001) et non 7. Le "7±2 items en UI" est un **[mythe]** (un menu relève de la reconnaissance, pas du rappel). Quand une info doit être **mémorisée** (code, comparaison entre écrans, wizard), tabler sur ~4 et **chunker** (téléphone, carte, IBAN, auto-formatage des champs).
- **Règle maîtresse** : **reconnaissance > rappel** — garder l'information à l'écran plutôt que d'exiger de la mémoriser.

### Principes Gestalt `[prouvé, perceptif]`
Proximité (le plus fort avant la couleur : rapprocher l'intra-groupe, espacer l'inter-groupe), similarité (même style = même fonction), **common region** (cartes/conteneurs > bordures partout), clôture, continuité, figure/fond (modale sur overlay assombri), destin commun (éléments animés ensemble), Prägnanz/symétrie (layout épuré = traitement plus rapide), **uniform connectedness** (connexion visuelle = groupement le plus fort). Utiliser d'abord **l'espacement** et les **conteneurs** pour structurer.

---

## 3. Charge cognitive `[prouvé]`

- Mémoire de travail limitée → minimiser la **charge extranéenne** (générée par le design) : supprimer le bruit visuel, éviter l'attention divisée (split-attention), une décision par écran, profilage progressif, défauts sensés.
- Canaux verbal et visuel séparés (Baddeley) → répartir l'info entre texte et visuel complémentaire augmente la capacité effective.
- **Divulgation progressive** (NN/g) : ne montrer d'abord que l'essentiel, différer l'avancé vers un 2e niveau (max 2 niveaux). Accordéons, bottom sheets, wizards.

---

## 4. Standards des plateformes (2025-2026)

### 4.1 Cibles tactiles & espacement (chiffres cross-platform)
| Référence | Minimum cible |
|---|---|
| Apple HIG | **44 × 44 pt** (60 pt visionOS) |
| Android Material 3 | **48 × 48 dp** (~9 mm) |
| WCAG 2.2 AA (2.5.8) | **24 × 24 px CSS** (plancher légal) |
| WCAG AAA (2.5.5) | **44 × 44 px CSS** (recommandé) |

→ Pour un produit multi-plateforme, **viser 44-48 px** couvre tout le monde (y compris WCAG AAA). Espacement **≥ 8 dp** entre cibles. Grille de base **8 pt** (+ sous-grille 4). Thumb-zone : ancrer navigation et actions primaires **en bas** (~75 % des interactions au pouce).

### 4.2 iOS — Apple Human Interface Guidelines
- **Langage "Liquid Glass"** (WWDC 2025, iOS/iPadOS/macOS 26) : matériau translucide adaptatif ; barres de navigation/onglets **flottent** au-dessus du contenu et peuvent devenir transparentes / se minimiser au scroll. Le contenu prime sur le chrome.
- **Principes** : clarté/hiérarchie (espacement, contraste, ordre), cohérence, simplicité (= retirer la friction). Typo plus **grasse et alignée à gauche** dans les moments clés (alertes, onboarding).
- **Navigation** : tab bar flottante en bas ; **sheets** avec detents `medium` / `large` + personnalisés ; toolbars transparentes.
- **Typographie Dynamic Type** : utiliser les **text styles système** (jamais de taille fixe) → mise à l'échelle jusqu'à 300 %+. Tailles "Large" (pt) : Large Title 34, Title1 28, Title2 22, Title3 20, Headline 17, **Body 17**, Callout 16, Subheadline 15, Footnote 13, Caption 12/11.
- **SF Symbols 7** (6 900+ icônes, alignées sur San Francisco ; Variable Draw, animations).
- **Dark mode** : couleurs **sémantiques** (adaptatives Light/Dark, niveaux primary→quaternary), fonds base vs elevated ; vérifier le contraste **aussi en dark**.

### 4.3 Android — Material Design 3 / Material 3 Expressive
- **Material 3 Expressive** (Google I/O 2025, Android 16) : plus émotionnel/lisible via mouvement, forme, couleur. **Validé par la recherche** (46 études, 18 000+ participants ; repérage des actions clés jusqu'à 4× plus rapide).
- **Dynamic Color / Material You** (espace **HCT** : Hue/Chroma/Tone) : 1 couleur source (souvent le wallpaper) → palettes tonales → **26 color roles** (primary, on-primary, surface…). Utiliser les rôles, pas des couleurs en dur.
- **Composants** : boutons sur 5 tailles (XS 32 / S 36 défaut / M 40 / L 48 / XL 56 dp) ; button groups, FAB menu, split button, loading indicator, toolbars.
- **Motion** : physique à ressorts (stiffness + damping) ; schemes Expressive (rebond, moments forts) vs Standard (utilitaire) ; tokens spatial vs effect.
- **Layouts adaptatifs** : window size classes — Compact < 600dp, Medium 600-839, Expanded 840-1199, Large 1200-1599, XL ≥ 1600. Navigation : bottom bar (Compact) → navigation rail (Medium/Expanded) → drawer permanent (Large/XL). 3 layouts canoniques : list-detail, supporting pane, feed. Gérer tablettes et foldables.
- **Type scale (sp, Roboto)** : Display 57/45/36, Headline 32/28/24, Title 22/16/14, **Body 16/14/12**, Label 14/12/11. Grille **8 dp** (sous-grille 4).

### 4.4 Web app
- **Core Web Vitals** (75e percentile) — objectifs "bon" :
  - **LCP** (chargement) **≤ 2,5 s** · **INP** (interactivité, remplace FID depuis 2024) **≤ 200 ms** · **CLS** (stabilité visuelle) **≤ 0,1**.
- **Responsive / fluide** : mobile-first ; typo fluide `clamp(min, préféré, max)` (ex. `clamp(16px, 1.5vw, 20px)`) ; **container queries** (responsive par composant) ; `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Design tokens** en 3 tiers : primitives → sémantiques → composant (format W3C DTCG). Outils : Style Dictionary, Tokens Studio.
- **Composants** : privilégier des bases **accessibles/headless** (Radix, Base UI, Headless UI) ; shadcn/ui (copy-paste, Tailwind) comme standard React ; sinon MUI, Chakra, Mantine.
- **Typo web** : corps **≥ 16 px**, line-height **≥ 1,5**, longueur de ligne **~45-75 caractères** (`max-width: 66ch`).

---

## 5. Accessibilité (WCAG 2.2 + science cognitive)

- **Contrastes** (WCAG 1.4.3 AA) : **4,5:1** texte normal, **3:1** grand texte (≥ 18 pt ou 14 pt gras) ; **3:1** pour composants UI et icônes informatives (1.4.11) ; 7:1 en AAA. Ne pas arrondir. Vérifier via un outil de ratio de contraste.
- **Cibles** : 24 px min (2.5.8 AA), 44 px recommandé (2.5.5 AAA).
- **Ne jamais coder une info par la couleur seule** (1.4.1) : ~8 % des hommes sont daltoniens → coupler couleur + icône/texte/forme (ex. erreur = rouge **+ icône + libellé**).
- **Mouvement** : respecter `@media (prefers-reduced-motion: reduce)` (2.3.3) ; **pas plus de 3 flashs/seconde** (2.3.1, épilepsie photosensible).
- **Texte redimensionnable** à 200 % sans perte (1.4.4) ; espacements ajustables (1.4.12).
- **Formulaires accessibles** (WCAG 2.2) : ne pas cacher le focus (2.4.11), alternative au glisser-déposer (2.5.7), pas de test cognitif à l'authentification + autoriser gestionnaires de mots de passe & copier-coller (3.3.8), aide cohérente (3.2.6), pas de re-saisie redondante (3.3.7).
- **Structure POUR** : Perceivable, Operable, Understandable, Robust. **Accessibilité cognitive (COGA)** : langage clair, navigation et identification cohérentes, charge cognitive réduite.
- **Design inclusif** (Microsoft) : "solve for one, extend to many" — concevoir pour un handicap permanent bénéficie aux limitations temporaires et situationnelles.
- **Cadre légal** (à respecter) : UE **European Accessibility Act** (applicable 28 juin 2025 ; e-commerce, banque, e-books, OS… ; réfère WCAG AA via EN 301 549). US **ADA** (WCAG 2.1 AA de référence). Viser **WCAG 2.2 AA** par prudence.

---

## 6. Engagement éthique (science validée)

Principe transversal : distinguer le **"wanting"** (pulsion, dopamine = erreur de prédiction, amplifiée par l'incertitude) du **"liking"** (plaisir réel) et du **bénéfice réfléchi**. Un design éthique aligne l'usage sur les buts que l'utilisateur **endosse**, pas sur le temps passé. Le temps-sur-app **n'est pas** un marqueur d'engagement sain (passion harmonieuse vs obsessive).

- **Théorie de l'autodétermination (Deci & Ryan)** `[prouvé]` : nourrir **Autonomie** (contrôle réel, notifs opt-in granulaires, pas d'imposition), **Compétence** (feedback **informationnel** "tu progresses", défi juste, progression visible), **Relatedness** (lien social authentique). C'est ce qui prédit une rétention **de qualité**.
- **Effet de surjustification** `[prouvé, méta-analyse 128 études]` : les récompenses tangibles/contrôlantes **sapent** la motivation intrinsèque (d ≈ −0,28 à −0,40). Préférer le feedback informationnel aux points/badges contrôlants. Le cadrage compte plus que la mécanique.
- **Modèle de Fogg (B = MAP)** `[fondateur]` : un comportement = Motivation × Ability × Prompt au même instant. Levier durable = **augmenter l'Ability (réduire la friction)** + déclencher au bon moment. Action **minuscule**, ancrée sur une routine existante.
- **Habitudes** `[prouvé]` (Wood & Neal ; Lally médiane ~66 j, fourchette 18-254 ; le "21 jours" est un mythe) : indice de contexte stable + placement constant + répétition. **Accélérateurs** : fréquence, timing, **comportement auto-choisi (autonomie)**, affect positif. Éthique : streaks avec **jours de grâce / gel**, jamais culpabilisants ; passer le "Regret Test" (si l'usage est prévisiblement regretté → manipulation).
- **Onboarding** — construire sur 3 effets **robustes** :
  - **Progression dotée (endowed progress)** `[prouvé]` : démarrer une barre non à zéro double presque l'achèvement (19 %→34 %).
  - **Goal-gradient** `[prouvé]` : on accélère près du but (précharger des étapes).
  - **Peak-end rule (Kahneman)** `[prouvé]` : soigner un **pic positif** (premier succès, "wow") et **finir chaque flux sur une note haute** ; la durée est négligée.
  - Réduire la charge cognitive (moins de champs, une décision par écran). L'effet **Zeigarnik** est `[contesté]` — ne pas en faire une loi.
  - Viser vite la **valeur cœur** (activation) ; ne citer aucun "magic number" (7 amis, 2000 messages) comme loi — ce sont des cadrages internes.
- **Notifications** `[prouvé]` : coût réel d'interruption (résidu attentionnel ; une notif nuit à l'attention **même non ouverte**). → **peu de volume**, aux **breakpoints** (fins d'épisode, moments réceptifs), **personnalisées par pertinence** (91 % de précision accepter/rejeter possible), **contrôle granulaire par catégorie** confié à l'utilisateur. Calibrer, ne pas matraquer (mais l'absence totale génère de l'anxiété).
- **Rétention** `[prouvé — ECM, Bhattacherjee 2001]` : la continuité = f(**satisfaction**, **utilité perçue**), via la **confirmation des attentes**, modérée par l'**habitude**. Retenir par **valeur réelle confirmée**, pas par verrouillage. Un plateau de rétention élevé = product-market fit authentique. (Benchmarks J1/J7/J30 = données industrielles indicatives, très dépendantes de la catégorie.)

---

## 7. Biais cognitifs & persuasion éthique

Utilisables **honnêtement** (vrais, au service de l'utilisateur), interdits dès qu'ils énoncent du faux ou retirent le choix libre :
- **Ancrage** (prix de référence — mais réel, jamais fictif), **cadrage** (positif, pas de confirmshaming), **aversion à la perte** (~2× un gain — sans perte fabriquée), **preuve sociale** (avis/compteurs **réels**), **rareté** (stock **réel**), **effet de défaut** (défaut = choix le plus bénéfique/attendu, **jamais** case pré-cochée à charge), **peak-end**, **von Restorff** (mettre en avant sans piéger les alternatives), **position sérielle** (ne pas enterrer "annuler/refuser" au milieu).

---

## 8. Dark patterns — désormais ILLÉGAUX (à proscrire absolument)

Ne jamais implémenter : fausse urgence/rareté, faux avis/compteurs, cases pré-cochées, coûts cachés (sneaking), interférence visuelle (bouton "Refuser" minuscule/grisé face à "Tout accepter"), roach motel (résiliation plus dure que l'inscription), confirmshaming, nagging, questions piège, publicités déguisées.

Cadre juridique opposable :
- **UE — DSA (Règl. 2022/2065) Art. 25** : interdit explicitement les interfaces trompeuses/manipulatrices (applicable depuis le 17/02/2024). **RGPD Art. 4(11)/7 + considérant 32** (cases pré-cochées = pas de consentement ; CJUE *Planet49*). **EDPB Lignes 03/2022**. **DMA Art. 13**.
- **US — FTC** : rapport 2022 ; *Epic/Fortnite* 520 M$ ; *Amazon Prime* 2,5 Md$ (2025) ; ROSCA / "click-to-cancel".
- **France — CNIL** : Google 150 M€ + Facebook 60 M€ (refuser les cookies plus difficile qu'accepter).

→ Une UI manipulatrice est **juridiquement actionnable**, pas seulement contraire à l'éthique.

---

## 9. Lisibilité & typographie

- Longueur de ligne **45-75 caractères** (~66 idéal), corps **≥ 16 px**, contraste **≥ 4,5:1**, interligne **≥ 1,5**, alignement à gauche (jamais justifié sur le web).
- Serif vs sans-serif : différence **marginale** sur écrans HD `[mythe hérité]` — ce qui compte : qualité du dessin, taille, espacement, longueur de ligne.
- Dyslexie : les polices "dyslexie" (OpenDyslexic…) sont `[contesté, sans bénéfice prouvé]`. Ce qui aide **réellement** : sans-serif standard (Arial, Verdana), 12-14 pt min, alignement à gauche, éviter italique/MAJUSCULES/souligné (préférer **gras**), fond crème/pastel plutôt que blanc pur, interligne ~1,5.
- Design émotionnel : couleurs, typo, illustrations, mascottes, micro-interactions — cohérent avec la marque et le contexte, sans surcharge.

---

## 10. Wireframes & création d'écrans

- Progression : **zoning** (blocs, basse fidélité) → **wireframe** (contenus, hiérarchie, interactions, gris, vrais textes, dimensions réelles, desktop **et** mobile) → **maquette haute-fidélité** → prototype.
- Produire **plusieurs variantes** d'écran rapidement (esprit Crazy 8 / 6-to-1) puis converger.
- Wireframer chaque écran clé et les **relier (wireflow)** pour montrer la navigation.
- Ne pas faire de graphisme au stade wireframe : se concentrer sur structure, fonctionnalités, responsive, titres et wording réels (pas de lorem ipsum).
- But : itérer vite et prendre de meilleures décisions avant d'investir dans le visuel/code.

---

## 11. Boîte à outils UX (mobiliser selon le besoin)

- **Recherche/besoin** : entretien semi-directif (questions ouvertes "Parlez-moi de…", "Montrez-moi…", "Qu'est-ce qui vous gêne ?" + relances), observation, questionnaire en complément.
- **Vrai problème** : méthode des **5 pourquoi** (remonter à la cause racine), reformulation "Comment pourrions-nous… ?".
- **Cibler** : **persona** (besoins, objectifs, contexte, frustrations, matériel, scénario — caractériser par l'activité), **carte d'empathie** (Says/Thinks/Does/Feels).
- **Parcours** : **carte d'expérience** (persona + objectif, phases, actions, émotions/points de friction, opportunités, points de contact).
- **Idéation** : brainstorming + diagramme d'affinité, Crazy 8.
- **Évaluation** : **audit heuristique** (Nielsen / Bastien-Scapin) avec gravité notée 1/3 mineur, 2/3 important, 3/3 majeur prioritaire, par écran et par parcours.

---

## 12. Checklist avant de livrer une UI

- [ ] Parcours principal vérifié de bout en bout, sans impasse.
- [ ] Cibles ≥ 44-48 px, espacées ≥ 8 px, actions primaires atteignables au pouce.
- [ ] Contrastes ≥ 4,5:1 (3:1 grand texte/UI), info jamais portée par la couleur seule.
- [ ] Texte ≥ 16 px, lignes 45-75 caractères, interligne ≥ 1,5, Dynamic Type/sp respectés.
- [ ] Standards de la plateforme respectés (HIG / Material 3 / conventions web).
- [ ] Responsive testé (mobile → tablette → desktop) ; Core Web Vitals visés (web).
- [ ] `prefers-reduced-motion` respecté ; pas de flash > 3/s.
- [ ] Formulaires : libellé + champ + placeholder distincts, champs obligatoires signalés, erreurs au niveau du champ, validation en temps réel, confirmation avant action irréversible.
- [ ] Feedback système < 400 ms (sinon indicateur de progression).
- [ ] Zéro dark pattern ; consentement libre ; contrôle utilisateur (annulation, notifs granulaires).
- [ ] Mini audit heuristique passé (organisation, cohérence, guidage, erreurs, accessibilité, rapidité, satisfaction).
- [ ] Test rapide envisagé (5 utilisateurs ≈ 85 % des problèmes d'un parcours).

---

## Sources principales
Apple Human Interface Guidelines (developer.apple.com) · Material Design 3 (m3.material.io) · W3C WCAG 2.2 / WAI (w3.org/WAI) · web.dev Core Web Vitals · Nielsen Norman Group (nngroup.com) · Laws of UX (lawsofux.com) · Sweller 1988 (charge cognitive) · Miller 1956 / Cowan 2001 · Fitts 1954 · Kahneman (peak-end, prospect theory) · Deci & Ryan (SDT ; méta-analyse 1999) · Fogg (behaviormodel.org) · Lally et al. 2010 / Wood & Neal 2007 (habitudes) · Bhattacherjee 2001 (ECM rétention) · Okoshi / Pielot / Mark / Leroy (notifications & attention) · Wagemans et al. 2012 (Gestalt) · Brignull (deceptive.design) · UE DSA/RGPD/EDPB, FTC, CNIL (dark patterns) · Orben & Przybylski 2019 (bien-être numérique) · cours "UX design et ergonomie web", Thomas Pascaud · "Ergonomie web & UX Design", Amélie Boucher.
