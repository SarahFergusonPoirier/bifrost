# Bilan consolidé des décisions d’architecture de Bifrost

## Objectif

Ce document consolide les décisions de conception prises jusqu’à la décision 90. Il sert à éviter de poursuivre une longue série de décisions individuelles avant d’avoir établi les fondations. Il ne signifie pas que toutes les fonctionnalités doivent être développées en v1.

## État général

- La vision fonctionnelle est suffisamment détaillée pour préparer le modèle de données.
- Les décisions de produit déjà prises doivent être conservées; les choix techniques non encore nécessaires ne doivent pas devenir de nouvelles questions prématurées.
- La PR de fondations reste documentaire. Les migrations, modèles et fonctionnalités ne doivent commencer qu’après validation du modèle conceptuel et du schéma initial.
- Les migrations existantes doivent rester immuables; toute évolution se fait par une nouvelle migration.

## Décisions regroupées par domaine

### 1. Espaces, projets et univers

- Les projets et les univers sont indépendants. Un projet peut avoir son propre univers, référencer un univers partagé ou combiner des éléments provenant de plusieurs univers.
- Les éléments partagés restent identifiables comme tels; leur portée ne doit pas être déduite de leur dossier ou de leur titre.
- Lorsqu’un contenu est réutilisé ailleurs, l’utilisateur choisit entre une référence partagée vivante et une copie indépendante.
- Les relations peuvent traverser les projets et univers lorsque les droits et la portée le permettent.
- Une fiche partagée peut avoir une variante locale dans un projet, avec valeurs héritées et valeurs locales distinctes.

### 2. Fondement commun des contenus

- Les fiches, documents, notes de recherche, idées et autres contenus doivent partager un fondement commun de métadonnées, d’identité, de relations et d’historique, tout en conservant des types spécialisés.
- Les conversions entre types doivent préserver le texte d’origine, les métadonnées pertinentes, les relations et la provenance. Une conversion doit être distinguée de la création d’une copie liée.
- Un contenu peut avoir plusieurs blocs de texte indépendants en plus de ses champs structurés.
- Le statut de travail et le statut canonique sont deux dimensions indépendantes. Terminer un contenu ne le rend pas automatiquement canonique; le retirer du canon ne le supprime pas.
- Les idées non validées restent distinctes du canon jusqu’à confirmation explicite.
- Les modèles de contenu sont personnalisables; les modèles système restent protégés et peuvent être copiés ou adaptés.

### 3. Modèles, champs et présentation

- Les types de contenu peuvent utiliser des modèles prédéfinis personnalisables ou des modèles créés par l’utilisateur.
- Les modèles et définitions de champs peuvent être globaux, propres à un projet ou propres à un univers.
- Les champs peuvent être réutilisables, propres à un modèle ou exceptionnels à un contenu particulier.
- Les modèles sont versionnés. Une mise à jour propose des changements aux contenus existants; l’utilisateur prévisualise et choisit quoi appliquer. Aucun champ ni contenu ne doit être écrasé silencieusement.
- Les sections et champs sont réordonnables. Le mode structuré est le mode par défaut; un mode de disposition libre peut déplacer et redimensionner les blocs sans modifier les données sous-jacentes.
- Les dispositions peuvent être réutilisées à plusieurs portées. Les modifications de disposition d’un modèle sont proposées aux contenus existants et ne remplacent pas les dispositions personnalisées.
- Les blocs de disposition peuvent inclure champs, sections, panneaux, texte libre, relations, ressources et éléments visuels.

### 4. Relations, suppression, doublons et historique

- Les relations sont explicites, typées, éventuellement directionnelles et dotées de propriétés. Les liens retour sont affichés automatiquement sans dupliquer la relation.
- Une mention dans du texte ne crée jamais automatiquement une relation; Bifrost peut suggérer une correspondance, mais demande confirmation.
- Les références manquantes doivent être représentables et distinguées des relations valides.
- Les contenus supprimés passent par une corbeille réversible. Avant une suppression, Bifrost présente les dépendances et laisse choisir le traitement des liens. La restauration permet de choisir les éléments à restaurer et signale les conflits.
- Les doublons potentiels sont signalés, jamais fusionnés automatiquement. Comparaison, liaison, copie indépendante et fusion assistée réversible sont prévues.
- L’archivage est distinct de la suppression et du statut canonique.
- L’historique détaillé concerne notamment les textes et changements importants; restauration sélective et résolution manuelle des conflits sont prévues.

### 5. Chronologies et variantes du canon

- Les dates peuvent être exactes, approximatives, des intervalles, des périodes ou des marqueurs narratifs sans date calculable.
- Les relations d’ordre permettent d’ordonner des événements sans inventer de dates.
- Plusieurs chronologies peuvent réutiliser les mêmes événements, de l’histoire générale à celle d’un personnage.
- Le canon principal et les canons de branches alternatives sont distincts. Une branche peut réutiliser le contenu inchangé et ne conserver que ses variantes.
- Les branches peuvent être comparées au canon et réintégrées sélectivement. La fermeture d’une branche permet l’archivage ou la suppression après comparaison et récupération éventuelle.

### 6. Ressources et recherche

- Les fichiers importés et les références vers des fichiers externes sont pris en charge et clairement distingués.
- Une ressource est distincte de ses usages. Un fichier encore utilisé ne doit pas être supprimé lors de la suppression d’un contenu qui le référence.
- Les ressources manquantes, collisions de noms et risques de suppression accidentelle doivent être signalés.
- La recherche peut porter sur métadonnées et texte, avec périmètre configurable, classement par pertinence, extraits et ouverture au passage correspondant.
- Les étiquettes peuvent être simples ou hiérarchiques, réutilisées entre espaces, fusionnées et remplacées globalement avec contrôle de leurs usages.
- Les vues et recherches enregistrées sont dynamiques, personnalisables et réutilisables aux portées globale, univers et projet.
- La bibliothèque de recherche permet de gérer des sources réutilisables, plusieurs citations/extraits par source, leur emplacement et les notes associées.

### 7. Idées, tâches et suivi

- La capture rapide conserve l’origine et l’historique. Une idée peut être convertie en un ou plusieurs contenus ou rester liée à des contenus créés séparément.
- Les tâches sont légères, personnalisables et peuvent être liées aux contenus; leur génération automatique n’est pas activée par défaut.
- Les objectifs sont facultatifs et peuvent être liés aux tâches et contenus.
- Les indicateurs du tableau de bord sont configurables; aucun pourcentage universel de progression n’est imposé.
- Les rappels sont facultatifs. Pour la version locale initiale, les indicateurs intégrés sont prioritaires; les notifications externes dépendent de la faisabilité technique.

### 8. Interface et personnalisation

- Navigation hybride avec barre latérale permanente et outils propres à chaque espace.
- Espace de travail flexible : onglets, éléments épinglés, affichage côte à côte et restauration de la session, développés progressivement.
- Espaces de travail enregistrables avec outils, onglets, dispositions et contexte.
- Raccourcis hybrides : récents et favoris automatiques, groupes personnalisés et raccourcis vers contenus, recherches, outils et espaces.
- Centre de notifications configurable, avec historique et priorités; comportement discret par défaut.
- Paramètres catégorisés et recherchables, avec distinction entre valeurs globales et exceptions par projet/univers.
- Apparence personnalisable, avec thèmes clair/sombre et réglages essentiels au départ.
- Accessibilité intégrée dès la conception et réglages progressifs pour contraste, animations, navigation et lisibilité.

### 9. Fiabilité, sécurité et évolution

- Sauvegardes automatiques configurables, sauvegardes intégrales ou ciblées, historique de conservation réglable et versions pouvant être protégées.
- Les sauvegardes doivent vérifier leur intégrité et signaler les ressources externes omises; une sauvegarde incomplète ne doit pas être présentée comme complète.
- Transfert de projets et migration complète de l’environnement sont prévus, avec vérification de compatibilité et signalement des fichiers manquants.
- Les mises à jour doivent être reportables, précédées d’une sauvegarde et accompagnées de migrations contrôlées et d’une procédure de récupération.
- Les diagnostics détectent les incohérences, expliquent les conséquences et proposent des réparations réversibles avec historique.
- Les journaux d’erreurs sont configurables et privés; les rapports exportés doivent éviter d’exposer le contenu des projets.
- Le verrouillage de contenus est facultatif, avec choix entre masquer le contenu ou masquer toute la fiche. Le déverrouillage est configurable et se reverrouille après inactivité.
- Le chiffrement des sauvegardes exportées est prévu; le chiffrement local peut être facultatif. Les clés et la récupération doivent être gérées sans promesse irréaliste de déchiffrement sans clé.
- Les fonctions expérimentales à risque peuvent être testées dans un espace isolé.
- L’architecture doit rester extensible, sans exiger un système complet de modules en v1.

## Ce qui est réellement bloquant avant le schéma initial

Les décisions produit ci-dessus sont suffisamment claires. Il reste à fixer quelques représentations techniques dans le document de données; ce ne sont pas 10 à 20 nouvelles décisions de produit.

1. **Modèle commun des contenus :** définir les tables communes et les données spécialisées par type, sans créer une table séparée pour chaque type de fiche.
2. **Champs personnalisés :** arrêter la stratégie de stockage et d’indexation qui permet types, filtres, recherche, définitions réutilisables, exceptions par contenu et variantes locales. Le JSON est une piste, mais doit être validé face aux besoins de recherche et d’héritage avant les migrations.
3. **Modèles et versions :** définir comment une version de modèle est liée au contenu, comment sont stockées les valeurs héritées/locales et comment une mise à jour est prévisualisée puis appliquée.
4. **Branches et variantes :** définir une représentation permettant de réutiliser les contenus inchangés et de stocker seulement les différences quand c’est approprié, tout en isolant le canon de chaque branche.
5. **Historique, corbeille et restauration :** définir les enregistrements nécessaires pour restaurer des contenus, relations, emplacements et valeurs sans écraser des changements plus récents.
6. **Ressources :** définir les métadonnées d’un fichier, ses références multiples, son mode importé/externe et la détection des usages avant suppression.
7. **Portées et références :** formaliser les clés et contraintes qui autorisent les relations entre projets/univers tout en distinguant copie, référence partagée, variante locale et référence manquante.

Ces points sont les dernières décisions techniques à documenter avant de créer les migrations fondamentales. Ils peuvent être traités dans un seul travail de conception, en choisissant des options techniques justifiées plutôt qu’en demandant à l’utilisateur de concevoir chaque table.

## À reporter après les fondations

Les éléments suivants ne doivent pas bloquer le premier schéma de données : éditeur riche avancé, dispositions libres très élaborées, command palette et raccourcis personnalisés, espaces de travail complets, centre de notifications détaillé, modules/extensions, outils expérimentaux, chiffrement complet des données locales et réglages d’interface très fins. Ils restent dans la vision de Bifrost, mais seront planifiés par étapes.

## Prochaine séquence recommandée

1. Aligner le document d’architecture des données sur les décisions consolidées.
2. Proposer un schéma relationnel initial et expliquer brièvement les choix structurants.
3. Vérifier que ce schéma couvre les cas difficiles : fiche partagée avec variante locale, branche alternative, conversion d’idée en fiche, restauration après suppression, fichier utilisé par plusieurs contenus.
4. Corriger et valider le schéma conceptuel.
5. Ajouter ensuite les nouvelles migrations, modèles Eloquent et tests d’intégrité, sans modifier les migrations historiques.

Aucune migration applicative n’est créée par ce document.
