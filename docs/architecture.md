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
