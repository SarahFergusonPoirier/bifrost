# Plan final — premières migrations de Bifrost

## Statut

Plan technique de référence pour le premier lot de migrations. Il complète le schéma relationnel proposé sans le remplacer. Les cinq migrations et les tests du lot 1 ont été ajoutés, appliqués et vérifiés localement.

## Contraintes à respecter

- Conserver SQLite comme moteur par défaut pour le développement local et les tests.
- Ne jamais modifier une migration déjà appliquée; toute évolution passe par une nouvelle migration.
- Préserver les projets, leurs favoris, leurs couvertures et leurs associations aux tags.
- Ajouter des clés étrangères, des index et des contraintes d'unicité lorsque le modèle le permet.
- Tester sur une base SQLite vide et sur une base existante issue des migrations actuelles.
- Ne pas ajouter dès maintenant les tables des variantes, branches, chronologies, tâches, sources de recherche ou notifications.

## Lot 1 — socle des contenus

Créer les nouvelles tables dans cet ordre logique :

### 1. `universes`

Identité indépendante d'un univers, pouvant être référencé par plusieurs projets.

Champs de départ :
- clé primaire;
- identifiant public stable et unique;
- nom et description facultative;
- paramètres non relationnels facultatifs;
- dates de création et de mise à jour;
- suppression réversible uniquement si son comportement est défini sans supprimer les contenus partagés.

### 2. `project_universe`

Association explicite entre projets existants et univers.

Champs et règles :
- clés étrangères vers `projects` et `universes`;
- rôle facultatif de l'association, par exemple univers principal ou complémentaire;
- unicité du couple projet/univers;
- suppression de l'association sans suppression automatique du projet ou de l'univers.

Ne pas ajouter de colonne `universe_id` obligatoire à `projects` : un projet peut être relié à plusieurs univers et un univers peut être utilisé par plusieurs projets.

### 3. `content_types`

Définitions de types de contenus, par exemple personnage, lieu, document, idée ou note de recherche.

Champs de départ :
- clé primaire et identifiant public stable;
- clé technique stable et nom visible;
- description facultative;
- portée (`system`, `global`, `project` ou `universe`);
- clés de portée facultatives;
- indicateurs de type système et d'activation;
- dates de création et de mise à jour.

Les règles Laravel et les tests doivent empêcher des combinaisons incohérentes de portée et de clés. Les types système ne doivent pas pouvoir être supprimés ou modifiés comme des types créés par l'utilisateur.

### 4. `contents`

Identité commune des fiches, documents, idées et notes.

Champs de départ :
- clé primaire et identifiant public stable et unique;
- clé étrangère vers `content_types`;
- titre et résumé facultatif;
- portée explicite (`global`, `project` ou `universe`);
- clés de portée facultatives;
- référence facultative vers le contenu d'origine, pour préserver la provenance d'une copie ou d'une conversion;
- état de travail;
- dates de création, de mise à jour et de suppression réversible.

Le statut de travail et le statut canonique restent deux notions différentes. Le canon par branche n'est pas implémenté dans ce lot.

**Statuts de travail du premier lot :** `draft` (Brouillon), `in_progress` (En cours), `completed` (Terminé) et `abandoned` (Abandonné). Ils sont validés côté serveur; une chaîne arbitraire n'est pas acceptée. Le statut `abandoned` est disponible pour tous les types de contenus et ne supprime ni la fiche ni ses blocs : le contenu reste conservé et peut être repris ou réutilisé. L'archivage reste distinct du statut de travail, via `archived_at`, afin de pouvoir masquer une fiche des vues habituelles sans la déclarer abandonnée. La personnalisation complète des statuts et leur table de définitions seront ajoutées dans un lot dédié.

Les clés de portée doivent rester cohérentes avec `scope_type`. Les contraintes inter-tables impossibles à garantir avec une simple clé étrangère doivent être vérifiées par la validation Laravel et des tests.

### 5. `content_blocks`

Blocs de texte libre rattachés à un contenu, indépendants de ses champs structurés.

Champs de départ :
- clé primaire et identifiant public stable;
- clé étrangère vers `contents`;
- type de bloc contrôlé;
- titre facultatif;
- corps du bloc;
- position;
- dates de création, de mise à jour et de suppression réversible si elle est nécessaire au modèle de restauration.

Ajouter un index sur le contenu et la position. Le corps ne doit pas contenir la disposition visuelle complète de l'interface.

## Ce qui est explicitement reporté

Ne pas créer dans ce lot :
- modèles et versions de modèles;
- définitions de champs personnalisés et valeurs typées;
- relations entre contenus et références externes;
- dossiers, placements et extension des tags aux contenus;
- variantes locales et branches alternatives;
- états de canon et historique détaillé;
- ressources et usages;
- chronologies;
- sources et extraits de recherche;
- tâches, objectifs, rappels et notifications.

Ces fonctionnalités restent prévues; elles seront ajoutées après validation du socle.

## Règles d'intégrité à tester

1. Un univers peut être associé à plusieurs projets, et un projet à plusieurs univers.
2. Supprimer une association projet-univers ne supprime ni le projet ni l'univers.
3. Les types et contenus système, globaux, de projet et d'univers respectent leur portée.
4. Un contenu ne peut référencer qu'un type existant.
5. Les identifiants publics sont uniques.
6. L'état de travail accepte uniquement les clés autorisées et possède une valeur par défaut.
7. Les blocs appartiennent à un contenu existant et leur ordre est stable.
8. Les suppressions réversibles ne détruisent pas les contenus ou projets partagés.
9. Les tables et associations existantes de projets et de tags continuent de fonctionner.
10. Les migrations passent sur une base vide et sur une base déjà migrée.

## État de l'implémentation

- [x] Inventaire des migrations versionnées dans le dépôt.
- [x] Migrations du lot 1 ajoutées sans modifier les anciennes.
- [x] Tests de schéma ajoutés : `tests/Feature/ContentFoundationSchemaTest.php`.
- [x] Modèles Eloquent et relations ajoutés pour les univers, types de contenu, contenus et blocs.
- [x] Tests de relations ajoutés : `tests/Feature/ContentFoundationModelsTest.php`.
- [x] Première couche de validation des portées et protection des types système ajoutées.
- [x] Tests d'intégrité ajoutés : `tests/Feature/ContentFoundationIntegrityTest.php`.
- [x] Migrations appliquées dans la base locale; avant les derniers tests d'intégrité, les 43 tests existants passaient.
- [x] Exécuter `php artisan test` après les derniers changements : 57 tests réussis (173 assertions).
- [x] Exécuter `npx vitest run` : 110 tests réussis dans 14 fichiers.
- [x] Exécuter `npm run build` : compilation Vite réussie.
- [x] Valider les clés de statut de travail côté serveur : brouillon, en cours, terminé et abandonné.
- [x] Garder l'archivage séparé des statuts de travail.
- [x] Vérifier les migrations sur une base SQLite neuve en mémoire via la suite de tests `RefreshDatabase`.
- [x] Appliquer les cinq migrations sur la base locale existante et vérifier que les tests Laravel passent.
- [x] Lot 1 stable; passer à la revue de conception du lot 2 avant d'ajouter de nouvelles migrations.

## Décisions techniques de départ

- **Base de données :** SQLite.
- **Portée :** explicite et validée côté serveur; ne pas la déduire d'un dossier ou d'un titre.
- **Partage :** les liens vers les univers expriment l'appartenance et l'accès; une copie reste distincte et conserve sa provenance.
- **Variantes et branches :** tables métier séparées plus tard; règle d'héritage proposée : contenu de base, puis variante locale, puis remplacement de branche.
- **Historique :** aucune table d'historique générique ou de canon avancé dans le lot 1.


## Lot 2 — modèles et champs personnalisés

### Périmètre retenu

Le lot 2 implémente uniquement la structure des modèles et les valeurs des champs personnalisés. Il ne comprend pas encore les relations générales entre contenus, les dossiers, les variantes, les branches, les chronologies ou l’historique rédactionnel général.

Tables prévues, dans cet ordre de dépendance :

1. `content_templates` — identité, type de contenu, portée, activation et éventuel modèle parent.
2. `template_versions` — versions numérotées d’un modèle; une version publiée est immuable.
3. `field_definitions` — identité stable, type et portée des champs réutilisables.
4. `template_version_fields` — champs présents dans une version, leur ordre, leur section et leurs réglages d’affichage.
5. `content_field_values` — valeurs conservées par contenu et définition de champ, indépendamment du modèle affiché.
6. `content_template_assignments` — affectation courante du modèle et de la version exacte à une fiche.
7. `content_template_update_events` — historique des mises à jour de modèle appliquées à une fiche, distinct de l’affectation courante.

Les migrations doivent respecter les clés étrangères et les dépendances. Les tables déjà appliquées ne sont jamais modifiées; ces tables sont ajoutées par de nouvelles migrations.

### Décisions de comportement

- Une fiche peut ne pas avoir de modèle; si elle en a un, elle n’a qu’une affectation courante.
- L’affectation conserve la version exacte utilisée. Une nouvelle version ne met jamais à jour les fiches automatiquement.
- L’application d’une version est une action explicite, avec aperçu des changements et résultat traçable.
- Les valeurs déjà saisies ne sont pas remplacées par des valeurs par défaut lors d’une mise à jour.
- Retirer un champ d’une nouvelle version ne supprime ni sa définition ni ses valeurs. La fiche permet de consulter les valeurs dans une section « Champs retirés du modèle ».
- Réintroduire un champ réutilise ses anciennes valeurs uniquement si la définition et le type sont compatibles.
- Un changement incompatible de type nécessite une nouvelle définition; aucune valeur historique n’est réinterprétée silencieusement.
- Les champs partagés peuvent avoir un libellé, une aide et une présentation propres à chaque version de modèle.
- Les portées des modèles et des champs doivent être compatibles avec le type et la portée du contenu.
- Les champs à valeur unique sont seuls pris en charge initialement. Les champs multivalués attendent un modèle de données dédié.
- Une valeur typée ne renseigne qu’une colonne compatible avec son type. Cette règle est validée par Laravel et par les tests.
- Les références vers d’autres contenus respectent les types cibles et les portées autorisées. Une cible supprimée de façon réversible reste référencée et est signalée comme indisponible.
- Les blocs de texte libre existants restent indépendants et ne sont pas modifiés par les mises à jour de modèle.
- Les lignes d’historique expliquent les mises à jour appliquées; elles ne remplacent ni l’affectation courante ni les valeurs de champs.

### Ordre d’implémentation et de validation

1. Relire les noms de colonnes, contraintes et règles de suppression des sept tables avant toute migration.
2. Créer les migrations dans l’ordre des dépendances ci-dessus.
3. Ajouter les modèles Eloquent et leurs relations, sans modifier les comportements existants des projets et des tags.
4. Ajouter la validation serveur des types, des portées, des versions et des colonnes de valeur.
5. Ajouter les tests d’intégrité ciblés ci-dessous.
6. Vérifier sur SQLite une base neuve et une base locale existante ayant déjà appliqué le lot 1.
7. Exécuter la suite Laravel, la suite Vitest et la compilation Vite avant de considérer le lot terminé.

### Tests d’intégrité obligatoires

- Une version appartient au modèle attendu et les numéros de version d’un même modèle sont uniques.
- Une version publiée ne peut pas être modifiée en place; une modification crée une nouvelle version.
- Un champ d’une version n’apparaît qu’une fois dans cette version.
- Les champs réutilisés respectent les portées autorisées, et leur libellé ou aide spécifique à une version ne modifie pas les autres versions.
- Une fiche sans modèle est valide; une fiche ne peut avoir deux affectations courantes.
- Une affectation ne peut pas associer un modèle à une version appartenant à un autre modèle.
- Le type de contenu et les portées de la fiche, du modèle et des champs sont compatibles.
- Une valeur ne peut renseigner plusieurs colonnes typées incompatibles; les types invalides sont rejetés.
- L’unicité contenu/champ empêche deux valeurs pour un champ à valeur unique.
- Le retrait d’un champ conserve sa définition et ses valeurs; celles-ci restent consultables comme champs retirés.
- La réintroduction d’un champ compatible récupère sa valeur; un type incompatible ne réutilise pas silencieusement l’ancienne valeur.
- Une valeur par défaut ajoutée à une nouvelle version n’écrase pas une valeur existante.
- Une mise à jour appliquée crée un événement d’historique cohérent et change explicitement l’affectation courante.
- Une référence vers une cible supprimée de façon réversible reste conservée et identifiable.
- Les blocs de texte libre restent inchangés lors d’une mise à jour de modèle.
- Les fonctions existantes des projets, couvertures, favoris et tags continuent de passer leurs tests.

### État du lot 2

- [x] Revue des règles de conservation des valeurs et d’immuabilité des versions.
- [x] Revue de la réutilisation des champs, des portées et des références.
- [x] Périmètre et ordre de dépendance documentés.
- [x] Vérifier les contraintes SQLite et documenter les règles d’intégrité.
- [x] Créer les sept migrations et les sept modèles Eloquent.
- [x] Ajouter les premiers tests d’intégrité ciblés (exécution locale encore nécessaire).
- [ ] Exécuter les suites Laravel/Vitest et la compilation Vite sur la branche mise à jour.
 
