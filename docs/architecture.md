# Architecture de Bifrost

## Vue d’ensemble

Bifrost est une application locale construite avec Laravel, Vue 3 et Vue Router.
Laravel fournit l’API et la persistance; Vue affiche l’interface et gère la navigation
côté client.

Pour les règles de conception des entités, des portées de données, des références et
des migrations, consulter [Architecture des données](data-architecture.md).
Le [bilan des décisions d’architecture](bilan-decisions-architecture.md) consolide
les choix fonctionnels et distingue les fondations des fonctionnalités à reporter.
Le [schéma relationnel initial proposé](schema-relationnel-propose.md) décrit les
entités, associations et contraintes envisagées avant la création des migrations.
Le [plan final des premières migrations](plan-premieres-migrations.md) fixe le périmètre du premier lot avant l'implémentation.

## Organisation du code

- `app/Models/` : modèles Eloquent et relations.
- `app/Http/Controllers/` : endpoints HTTP et validation des données reçues.
- `routes/api.php` : routes de l’API; les URL publiques de l’API commencent par `/api`.
- `routes/web.php` : renvoie la vue qui monte l’application Vue pour les URL de navigation.
- `resources/js/views/` : pages; conserver le modèle existant avec un fichier `.vue`
  pour le template et un fichier adjacent `.js` pour la logique.
- `resources/js/components/` : composants d’interface réutilisables, eux aussi séparés
  en fichiers `.vue` et `.js` lorsque le composant possède une logique.
- `resources/js/composables/` : logique Vue réutilisable lorsqu’elle est réellement
  partagée entre plusieurs composants/pages.
- `resources/js/services/` : appels HTTP à l’API. Les vues et composants passent par
  ces services plutôt que de construire leurs propres requêtes.
- `resources/css/` : styles globaux, jetons de design et styles de composants.
- `tests/Feature/` : tests de l’API et du comportement Laravel.
- `tests/js/` : tests Vitest de l’interface, des services et des composables.

## Conventions

1. **Templates et logique séparés :** suivre la structure existante `.vue` + `.js`.
2. **Requêtes centralisées :** placer les appels à l’API dans `resources/js/services/`.
3. **Validation côté serveur :** Laravel reste l’autorité pour les règles de données; la
   validation cliente améliore l’expérience, mais ne la remplace pas.
4. **Relations explicites :** utiliser les relations Eloquent pour les données liées
   (par exemple projets et tags), et tester les associations ainsi que leur suppression.
5. **Composables justifiés :** ne pas créer une couche d’abstraction pour une seule
   utilisation si elle ne simplifie pas réellement le code.
6. **Tests ciblés :** ajouter ou ajuster les tests lors d’un changement de comportement;
   couvrir les états de chargement, d’erreur et les actions importantes de l’interface.
7. **Interface en français :** conserver le français pour les libellés visibles de Bifrost.
8. **Local d’abord :** éviter d’ajouter une dépendance à un service hébergé pour les
   fonctionnalités de base sans décision explicite.

## Vérifications avant de terminer un changement

Depuis la racine du projet, exécuter :

```bash
npx vitest run
php artisan test
npm run build
```

## Présentation des fiches

Les composants de présentation des fiches se trouvent dans
`resources/js/components/fiche`. `FicheBlock` définit la structure commune
des cartes et expose un emplacement pour leurs actions. `FicheText` gère la
lecture des textes longs à l’intérieur d’une carte. `FicheTextEditor` fournit les
commandes de mise en forme et le sélecteur de fiches liées pour le résumé, les
blocs de texte, les biographies et les descriptions de capacités. Le format
textuel existant reste la représentation enregistrée. `ficheTextFormat.js`
reconnaît les éléments de mise en forme et garde les coupures d’aperçu hors de
ces éléments. `FicheOverview` projette les valeurs du brouillon et du modèle
dans les cartes.

L’éditeur, l’enregistrement du brouillon, la récupération et l’historique
restent gérés par `ContentRecoveryView`. Les styles des cartes et de la
navigation de fiche réutilisent les variables du thème dans
`resources/css/components/fiche.css`. La grille adapte son affichage à la largeur du panneau. Les dimensions et les placements sont enregistrés dans la disposition de chaque onglet.

### Disposition par onglet

L’API fiche-layout versionne la disposition par fiche et vérifie le projet à
chaque lecture ou écriture. Chaque onglet peut contenir des placements
ordonnés, avec dimensions, état réduit et visibilité. Une clé source pointe
vers un résumé, les étiquettes, une section du modèle ou un bloc de texte
existant. Déplacer ou retirer un placement ne modifie pas cette source.
Plusieurs placements peuvent pointer vers la même source, y compris dans un
seul onglet. La duplication indépendante du résumé et des blocs de texte crée
une nouvelle source dans la même transaction que sa disposition. Les transferts
en attente font partie du brouillon de disposition. Ils peuvent être annulés
individuellement avant l’enregistrement.

Le signalement des données partagées compare les identifiants canoniques des
champs sélectionnés, même lorsque leurs placements proviennent de sources
différentes. Des sélections sans champs communs ne sont pas signalées comme
partagées. Les copies indépendantes en préparation possèdent une identité
distincte jusqu’à l’enregistrement de leurs nouvelles définitions.

Les sources `fields:<identifiant de bloc>` utilisent `content_blocks` comme
instances. Leur `field_schema` conserve la présentation et les identifiants de
définitions propres au bloc ; leurs valeurs restent dans `content_field_values`.
La duplication d’une section crée de nouvelles définitions dans le projet et
copie les valeurs dans la même transaction que la disposition. L’ordre des
champs est remappé vers les nouveaux identifiants. Retirer un placement conserve
ces données et les instantanés de fiche permettent de restaurer le schéma.
Les modèles de blocs et d’onglets enregistrent leurs schémas sous forme de
`field_blocks`, avec des emplacements locaux aux modèles. Ils excluent les
valeurs actuelles et les identifiants des définitions de la fiche source.
L’application transmet l’identifiant et la révision du modèle ; le serveur
vérifie sa portée et crée de nouvelles définitions dans le projet cible.
Plusieurs placements d’un même emplacement partagent une seule nouvelle
instance. Les contraintes de références propres au projet empêchent une
publication globale qui élargirait silencieusement les types autorisés.
Une disposition enregistrée sans placements explicites conserve son aperçu
par défaut. La grille utilise douze colonnes sur grand écran comme choix
technique réversible et réduit le nombre de colonnes sur écran étroit.
Les seuils dépendent de la largeur du panneau de fiche. Le thème peut définir
`--fiche-row-height` pour ajuster la hauteur minimale d’une rangée. La poignée
de redimensionnement utilise la hauteur calculée du bloc comme référence.

`FicheTabs` sélectionne un onglet visible à partir de la disposition de la
fiche. `ContentRecoveryView` ouvre les liens directs à partir des paramètres
`fiche` et `onglet` de la page du projet. Le lien est vérifié contre le projet
actif. Si l’onglet demandé a été masqué ou retiré, l’interface revient à la vue
d’ensemble ou au premier onglet visible.

### Données liées et médias

`FicheLinkedData` présente les relations, la chronologie, les équipements et les
capacités à partir de l’API fiche-links et des entrées locales. Le bouton
« Voir tout » sélectionne un onglet visible contenant le bloc ou ouvre une
fenêtre de détail. Les relations et les équipements référencés utilisent les
titres et aperçus des fiches sources.

`ContentAttachments` réutilise l’API de pièces jointes pour la liste de fichiers,
l’image unique et la galerie. Les légendes et textes alternatifs sont conservés
dans les métadonnées de la ressource. L’API identifie les anciennes images au
chargement et vérifie le type du fichier avant de servir son aperçu.

### Champs et modèles

`App\FieldSchema` centralise les règles de validation, les attributs des
définitions et les options de présentation communs aux modèles et aux blocs
libres. `FicheFieldBlockBuilder` prépare un schéma dans le navigateur ; il
réutilise le catalogue de types commun et transmet un bloc `blank-fields`
uniquement lors de l’enregistrement de la disposition. Le serveur crée ses
définitions et son schéma dans la même transaction. Les valeurs sont saisies
ensuite avec les éditeurs habituels. Les champs obligatoires sont contrôlés
lors de l’enregistrement des valeurs, sans effacer les autres modifications
en cas de validation refusée.
Les schémas des nouveaux blocs sont validés avant cette transaction, copie
par copie, afin de garder une validation complète sans multiplier les règles
imbriquées pour les autres opérations de disposition.

`FicheDefaultValueEditor` réutilise les éditeurs de valeurs pour préparer les
défauts typés des modèles et des blocs libres. `FieldSchema::applyDefaults`
les valide et les crée uniquement si aucune valeur n’existe. À la mise à jour
d’un modèle de fiche, seuls les champs nouvellement introduits sont concernés :
une ancienne valeur modifiée ou effacée n’est pas réinitialisée. La duplication
indépendante copie l’état courant, tandis qu’une création depuis un modèle
applique ses défauts configurés. Les états explicites, zéro et faux restent
distincts des valeurs absentes.

Les définitions et les versions du modèle décrivent les champs. Les valeurs
appartiennent à la fiche et sont associées aux identifiants des définitions.
Dans Vue, `templateFields.js` associe les types à leurs colonnes de valeur et
groupe les champs par section. `formatFieldValue.js` donne une présentation
commune à la lecture et à l’historique, y compris pour les dates approximatives.
Les états vide, inconnu et non applicable restent distincts.

Le type `rich_text` utilise la colonne canonique `value_text` et active
l’éditeur enrichi dans toutes les sections. Les anciennes biographies restent
compatibles. Les exceptions de normalisation dans `bootstrap/app.php`
conservent les espaces et retours à la ligne des textes rédigés, des résumés
et des descriptions enrichies ; les titres et libellés restent nettoyés.

`fieldTypes.js` centralise les types disponibles dans l’éditeur de modèles et
les formats structurés reconnus par les fiches. Un champ Image stocke
uniquement l’identifiant public d’une pièce jointe de la fiche. Il réutilise
`ContentAttachments` pour la lecture, les légendes et les textes alternatifs.
La validation vérifie le fichier avec `Resource::attachmentImageMime()` ;
retirer la valeur du champ conserve la pièce jointe. Une référence déjà
enregistrée vers une image devenue indisponible reste lisible comme manquante
et ne bloque pas les autres modifications de la fiche.

Les placements de section existants peuvent retrouver une section renommée
par ses anciens libellés. En cas de correspondances multiples, la résolution
exige une correspondance unique. Le nom complet et l’âge dérivé utilisent
également cette convention pour retrouver la section Identité.

`FicheEntryFields` fournit les champs de texte complémentaires des capacités
et équipements locaux. Chaque entrée conserve une liste ordonnée de champs
`{ id, label, value }` dans sa valeur canonique, avec vingt champs au maximum.
Le texte réutilise le même éditeur et le même rendu enrichi que les biographies.
Les identifiants sont conservés lors d’un changement d’ordre et renouvelés
lors d’une duplication indépendante. La validation de `ContentFieldValue`
contrôle la structure et les limites avant l’enregistrement transactionnel.

`FicheTabs` gère la navigation, l’édition et les modèles réutilisables
d’onglets. Ces modèles enregistrent une disposition dans la bibliothèque du
projet ou dans la bibliothèque globale. Le contenu métier demeure dans les
fiches. Les styles de la grille et des blocs réutilisent les variables de
`resources/css/base/tokens.css` pour suivre le thème actif.

Les modifications de schéma des blocs de champs sont préparées localement,
puis envoyées avec la disposition dans `block_updates`. Le serveur vérifie
la version et l’appartenance de chaque champ dans une même transaction.
`ContentSnapshots` centralise la capture des révisions : une copie de la
fiche précède toute modification de schéma. Retirer un champ de ce schéma
conserve sa valeur archivée ; renommer ou réordonner conserve son identifiant.
Les valeurs par défaut ne sont appliquées qu’aux nouveaux champs. Changer
le type d’un champ existant nécessite d’ajouter un nouveau champ ; modifier
une échelle demande une confirmation explicite de conservation des valeurs.

L’analyse de suppression des blocs couvre les textes et les blocs de champs.
Un placement masqué ou une disposition historique bloque la suppression,
y compris lorsqu’un bloc commun affiche les champs concernés. L’empreinte
de confirmation inclut le schéma pour refuser une décision devenue obsolète.
Supprimer un bloc de champs orphelin conserve les définitions et les valeurs
canoniques, qui restent accessibles parmi les champs archivés de la fiche.

`RepeatableFields` prépare le schéma des sous-champs typés des listes
structurées dans `options_data.entry_fields`. Chaque membre possède une clé
UUID stable et chaque entrée conserve ses valeurs typées sous `values`.
Le stockage reste dans la valeur canonique du champ parent. La validation
réutilise `ContentFieldValue::validateForContent`, avec les mêmes contrôles
de portée, de références, d’images, de choix et d’états explicites.
Les schémas acceptent vingt membres par groupe et trois niveaux de listes.
Les dates imbriquées alimentent la chronologie par une clé stable composée
des identifiants des entrées et des membres ; décocher conserve la date.
La bibliothèque globale vérifie récursivement les restrictions et défauts
pour ne pas transporter des références propres à un projet.
`FicheFieldBlockBuilder` réutilise son éditeur pour configurer récursivement
les sous-champs avant la création du groupe. Une structure en cours doit
être appliquée avant de préparer le bloc parent. `fieldSchemaSpecs` traduit
les descripteurs persistés en configuration éditable et prépare les aperçus.
`FicheValueEditor` fournit la saisie commune des valeurs typées ;
`FicheDefaultValueEditor` est son adaptation pour les valeurs par défaut.
`FicheGroupValues` gère la saisie et la lecture des membres d’une entrée,
et `FicheEntryList` centralise le rendu des listes, descriptions et dates.
Ces composants réutilisent les classes et variables du design existant.
La structure personnalisée d’un groupe enregistré est portée par
`display_options.entry_fields`, sans modifier la définition source. Les clés
des membres survivent aux renommages et changements d’ordre. Les membres
retirés y restent marqués `retired` : leurs valeurs sont lisibles, protégées
contre une omission lors d’une sauvegarde, et exclues de la saisie courante.
Une révision complète précède la modification et restaure aussi le schéma.
Un changement de type ou de restriction de référence exige un nouveau membre ;
un changement d’échelle demande une stratégie explicite. Les modèles globaux
contrôlent récursivement ce schéma personnalisé comme la définition source.
Les défauts des membres actifs s’appliquent aux nouvelles entrées sans
remplacer les valeurs des entrées existantes.

Le format `attachment` conserve uniquement l’UUID du fichier sous
`value_json.attachment`. La sélection utilise les pièces jointes existantes
de la fiche ; `ContentAttachments` relit leur nom, légende et lien canonique
avec `attachmentId`, sans recopier ces métadonnées dans le champ. Une nouvelle
référence doit appartenir à la fiche et provenir du stockage des pièces jointes.
Une référence anciennement valide peut rester enregistrée si le fichier est
retiré de la fiche ; la lecture signale alors son indisponibilité. Effacer
le champ ne supprime ni la ressource ni le fichier. Les groupes répétables
réutilisent la même validation. Un défaut pointant vers un fichier local
est refusé dans les modèles globaux, y compris dans un groupe imbriqué.

Les références simples et multiples intégrées aux groupes utilisent aussi
`FicheReferenceCreate` lorsque `allow_reference_creation` est activé. Le
contexte du projet et les types accessibles traversent récursivement les
éditeurs. L’événement `reference-created` remonte jusqu’à la vue pour mettre
à jour le catalogue local des cibles, puis la valeur typée référence l’ID
numérique ou l’UUID canonique de la fiche créée. Le résultat doit appartenir
au projet et à un type autorisé. Les erreurs conservent la saisie et la limite
de deux cents références reste appliquée, y compris après une création lente.

L’éditeur de champs propose un réglage commun aux échelles d’un bloc : nombre
de niveaux et affichage en segments, chiffres ou les deux. Ce réglage est
préparé localement, avec aperçu des changements et confirmation de conservation
pour les échelles existantes ; il doit être appliqué ou annulé avant de préparer
le bloc. Les paramètres sont ensuite persistés sur chaque champ par le même
contrat de schéma, sans deuxième mécanisme d’écriture. Les descriptions des
niveaux supérieurs restent enregistrées lors d’une réduction de l’échelle,
même si seules les descriptions des niveaux affichés sont présentées.

L’historique des sous-champs répétables utilise les révisions du champ parent.
`fieldHistoryValue` suit un chemin composé d’UUID d’entrées et de clés de membres,
sans dépendre de leur position. `FicheEntryList` et `FicheGroupValues` transmettent
ce chemin et l’identifiant du champ canonique à `FicheFieldHistory`. Le rendu
des anciennes valeurs réutilise les composants typés, sans rouvrir leur propre
historique. Les doublons sont identifiés par la valeur canonique plutôt que
par le libellé affiché. Une réponse de chargement devenue obsolète après un
changement de fiche ou de chemin est ignorée.

Les blocs généraux Capacités et Équipements utilisent par défaut les champs
du modèle de fiche. Les champs des blocs indépendants ne rejoignent pas ces
listes implicitement. Le réglage « Champs partagés dans ce bloc » sélectionne
explicitement des définitions canoniques via `placement.field_order`. La lecture,
le signalement du partage et l’action d’édition utilisent la même sélection.
L’analyse de suppression protège aussi ces liens actuels et historiques.
Les mots-clés des blocs indépendants restent également séparés des étiquettes
générales. Les champs de capacités et d’équipements sont rendus avec leurs
descriptions et champs complémentaires lorsqu’ils figurent dans un bloc libre.
Le bloc Capacités accepte le mode liste ou cartes ; une liste compacte ouvre
les descriptions complètes dans la vue dédiée.
Les modèles de bloc et d’onglet conservent les schémas nécessaires aux sélections
de champs indépendants sous `field_blocks`. Leurs `field_bindings` désignent des
emplacements dans ces schémas, sans identifiants de valeurs de la fiche source.
`templatePlacements` prépare des copies structurelles et des `bind_to` temporaires.
Le serveur crée les définitions propres à la fiche cible puis remappe la sélection,
dans la même transaction que le layout. Un schéma partagé par plusieurs placements
n’est créé qu’une fois ; seules les valeurs par défaut configurées sont appliquées.
Les positions des champs, les types liés, la version du modèle et les placements
cibles sont vérifiés avant l’enregistrement. L’aperçu liste les nouveaux champs.

La publication des modèles de fiches globaux réutilise le même contrôle des
défauts que la bibliothèque de blocs. Les références à des fiches et aux fichiers
locaux y sont refusées, y compris les images des équipements intégrés, les
défauts des membres de groupes et les valeurs imbriquées d’un défaut de groupe.
Les équipements sans fichier et les états explicites restent réutilisables.
Un refus annule la version, ses définitions et son modèle lorsqu’il est nouveau.

`display_options.hide_empty` permet à chaque champ de remplacer la règle de
lecture du bloc : `true` masque les valeurs vides, `false` les affiche et
l’absence de propriété hérite du bloc. La configuration reçoit `null` pour
revenir à cet héritage. Les groupes répétables propagent la règle à leurs
membres, dont les réglages explicites restent prioritaires. L’édition présente
toujours les champs actifs. Zéro, faux, « inconnu » et « non applicable » ne
sont pas des valeurs vides. Les valeurs et les révisions restent conservées.

`config/fiche-block-dimensions.json` centralise les limites de grille par type.
Le serveur les applique avec `FicheBlockDimensions` et le client avec
`blockDimensions`, pour les contrôles numériques, les poignées et les modèles
réutilisés. Une ancienne dimension hors des nouveaux minima peut être relue
et conservée si le placement et sa source restent identiques. L’ouverture de
l’éditeur prépare un aperçu conforme aux limites sans modifier la disposition
enregistrée ; seule sa sauvegarde persiste ces dimensions. Les valeurs de la
fiche ne sont jamais changées par ce réglage de présentation.

L’éditeur des modèles de fiches réutilise aussi `FicheFieldBlockBuilder` pour
les schémas de groupes. Il conserve leurs clés et les adaptations de présentation,
exige l’application de la structure avant publication, et expose la règle des
valeurs vides. Les données de travail de l’éditeur ne sont pas envoyées à l’API.
La validation des nouveaux membres utilise la portée du modèle publié : une
variante de projet peut ajouter ses références locales tout en conservant la
définition canonique globale du champ parent. La version globale reste inchangée.

Les groupes prédéfinis d’identité fournissent leurs sous-champs typés : périodes
et motif pour les anciens noms, période pour les titres, référence facultative
et période pour la nationalité, niveau et remarques pour les langues. Chaque
ajout reçoit de nouvelles clés de membres ; la déduplication des alias utilise
le libellé canonique, sans générer d’identifiants inutiles. Le nom de l’entrée
est configurable par `display_options.entry_label` et suit les versions du modèle.
Lorsqu’un groupe définit ses propres membres, l’éditeur présente ces membres
et le nom de l’entrée. Les anciens champs génériques restent éditables tant
qu’ils contiennent une valeur ; aucune conversion automatique ne les efface.

`FicheBlockActionMenu` regroupe les actions de lecture dans une divulgation
native accessible : fermeture par Échap avec retour au déclencheur, clic
extérieur ou choix d’une action. Les paramètres ouvrent le brouillon de layout
et placent le focus sur les dimensions du placement choisi ; aucune écriture
n’a lieu avant l’enregistrement explicite. Le redimensionnement reste accessible
directement dans l’aperçu d’édition et le signal de partage reste visible.

Après une écriture de lien réussie, `FicheLinkedData` émet `changed` avec son
instance d’origine. `FicheOverview` recharge les autres vues liées du même
onglet via leurs références de composants ; l’origine vient déjà de se recharger.
Cela synchronise les placements partagés sans modifier leurs paramètres visuels
ni réécrire leurs valeurs. Une écriture refusée conserve la vue et son erreur,
sans émettre de changement réussi. Retirer un lien ne supprime pas la fiche cible.
Les chargements portent un compteur local : une réponse ou une erreur d’une
ancienne requête ne remplace jamais le résultat d’une requête plus récente.
Le démontage invalide également les lectures en cours.

Les dates simples gardent leur valeur canonique dans `value_date`. La colonne
nullable `date_options` contient uniquement leur lien de chronologie, son titre,
sa description et son calendrier. Ces options ne peuvent accompagner ni un
autre type de valeur ni un état explicite sans date. `FicheDateEditor` est commun
aux fiches, sous-champs et valeurs par défaut ; effacer la date efface ses options,
décocher le lien conserve la date. Les chronologies projettent les dates simples
et structurées avec des clés stables, sans créer de copie d’événement. Les dates
des groupes emploient le chemin des identifiants de membres et d’entrées.
Les snapshots et les copies indépendantes conservent ces options. La migration
ajoute la colonne sans transformer les dates existantes ; un retour arrière
supprime ses métadonnées, donc une correction en avant est préférable après usage.

Les composants de lecture et de références suivent aussi la séparation des
fichiers adjacents : `FicheText`, `FicheInlineText`, `FicheTags`,
`FicheReferencePicker` et `FicheReferenceCreate` gardent leur template dans le
`.vue` et leur état, calculs et actions dans le `.js`. Le parseur commun reste
dans `ficheTextFormat`, les requêtes dans `contentRecovery` et les styles dans
`resources/css/components/fiche.css`. Les composants purement déclaratifs tels
que `FicheBlock` et `FicheScale` peuvent garder leurs seules déclarations de
propriétés dans le template Vue, sans ajouter une abstraction sans comportement.

## Vérification du cahier des charges des blocs et onglets

Les points ci-dessous indiquent les preuves à consulter lors de la recette ;
la présence d’un test ne vaut pas validation de tous les détails d’une section.

| Périmètre du cahier | Sources et couverture de référence |
| --- | --- |
| 1–2 : séparation données/présentation, grille, dimensions, ordre, visibilité, réduction, restauration | `FicheLayoutController`, `FicheBlockDimensions`, `FicheOverview`, `FicheLayoutTest`, `FicheOverview.test.js` ; contraintes CSS par conteneur dans `fiche.css` |
| 3 : bibliothèque, recherche, prévisualisation, portée, versions | `FicheTabTemplateController`, `templatePlacements`, `FicheTabs`, `FicheOverview` ; tests de modèles globaux, révisions approuvées et liaisons de schémas |
| 4 : champs, états explicites, références, dates répétées, historique | `FieldSchema`, `RepeatableFields`, `ContentFieldValue`, `FicheValueEditor`, `StructuredField`, `FicheFieldHistory` ; `RepeatableFieldsTest`, `FieldDefaultsTest`, `AttachmentFieldTest`, tests JS des groupes et de l’historique |
| 5 : identité et catalogue optionnel | `CharacterIdentitySeeder`, `identityFieldCatalog`, génération du nom dans `ContentRecoveryView` ; `WorldbuildingCatalogTest`, `IdentityFieldGroups.test.js`, `characterAge.test.js`, `ContentRecoveryView.test.js` |
| 6 : attributs et échelles | `CharacterBlocksSeeder`, `FicheScale`, réglages communs dans `FicheFieldBlockBuilder` ; tests de changements explicites et de conservation des niveaux historiques |
| 7–9 : capacités, textes enrichis, personnalité | `StructuredField`, `FicheEntryList`, `FicheText`, `FicheTags` ; tests d’édition longue, rendu sûr, expansion locale, pastilles et duplication indépendante des entrées |
| 10–12 : relations, chronologie, équipements canoniques | `FicheLinkedDataController`, `ProjectConnectionController`, `FicheLinkedData` ; `ProjectConnectionTest`, `ProjectTimelineTest`, `FicheLayoutTest` et tests JS des vues liées |
| 13–14 : tags, mots-clés et médias | `FicheTags`, `ContentAttachments`, `ContentAttachmentController` ; tests de séparation des mots-clés, limites d’affichage, métadonnées, contrôles des fichiers et références conservées |
| 15–16 : blocs libres et actions | `FicheFieldBlockBuilder`, `FicheBlockActionMenu`, `FicheBlockDeletion`, `FicheLayoutController` ; tests de copies, champs requis, valeurs retirées, annulation, conflits et dépendances avant suppression |
| 17 : onglets, partage, déplacements, suppression sûre, liens directs | `FicheTabs`, `FicheOverview`, `ContentRecoveryView` ; `FicheTabs.test.js`, `FicheOverview.test.js`, `FicheLayoutTest` |
| 18 : architecture et persistance | tables existantes de modèles/valeurs, `content_blocks.field_schema`, layouts et révisions ; pas de table parallèle pour chaque type de bloc |
| 19 : recette transversale | suites PHPUnit/Vitest et compilation, puis vérification visuelle des fiches, vues complètes, changements d’onglets et contrôles clavier |

Points à ne pas confondre pendant la recette : une copie de champ ou de texte
possède ses propres valeurs ; une référence vers une fiche continue de lire
la fiche canonique. Les vues Relations, Chronologie et médias affichent des
enregistrements liés. Leur ajout sur une autre page ne doit pas cloner les
relations sémantiques, les événements ou les fichiers sous-jacents. La recette
finale doit encore vérifier les parcours complets de ces choix et les vues
étroites, au-delà des scénarios unitaires et des vérifications ponctuelles.
