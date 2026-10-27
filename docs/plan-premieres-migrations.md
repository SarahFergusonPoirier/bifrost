# Plan final — premières migrations de Bifrost

## Statut

Plan technique de référence pour le premier lot de migrations. Il complète le schéma relationnel proposé sans le remplacer. Les cinq migrations et un premier fichier de tests de schéma ont maintenant été ajoutés à la branche; les tests doivent encore être exécutés localement.

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

**Statuts de travail pour le premier lot :** utiliser des clés système validées côté serveur, avec une valeur par défaut définie. Ne pas accepter une chaîne arbitraire comme statut valide. La personnalisation complète des statuts et leur table de définitions seront ajoutées dans un lot dédié, avant de développer l'interface de gestion des statuts. Cette décision limite le premier lot sans fermer la voie à la personnalisation future.

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
- [ ] Exécuter à nouveau `php artisan test` après les derniers changements et corriger tout échec.
- [ ] Exécuter la suite JavaScript et le build pour vérifier l'absence de régression.
- [ ] Compléter la validation des clés de statut de travail avant de développer les points d'entrée d'édition des contenus.
- [ ] Vérifier le lot sur une base SQLite neuve et sur la base locale existante.
- [ ] Passer au lot 2 seulement lorsque le lot 1 est stable.

## Décisions techniques de départ

- **Base de données :** SQLite.
- **Portée :** explicite et validée côté serveur; ne pas la déduire d'un dossier ou d'un titre.
- **Partage :** les liens vers les univers expriment l'appartenance et l'accès; une copie reste distincte et conserve sa provenance.
- **Variantes et branches :** tables métier séparées plus tard; règle d'héritage proposée : contenu de base, puis variante locale, puis remplacement de branche.
- **Historique :** aucune table d'historique générique ou de canon avancé dans le lot 1.
