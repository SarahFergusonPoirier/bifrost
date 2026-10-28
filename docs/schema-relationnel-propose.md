# Schéma relationnel initial proposé — Bifrost

## Statut du document

**Proposition à valider — aucune migration n’est créée par ce document.**

Ce schéma traduit les décisions fonctionnelles consolidées dans [le bilan d’architecture](bilan-decisions-architecture.md). Il est volontairement relationnel et indépendant d’un moteur SQL précis. Les détails d’implémentation Laravel, les types SQL exacts et les index finaux seront confirmés avant les migrations.

## Principes structurants

1. Une seule identité de contenu pour les fiches, documents, idées et notes; les différences de comportement viennent du type et des données spécialisées.
2. Les projets et les univers sont indépendants et reliés par des tables d’association explicites.
3. Les relations entre contenus sont des enregistrements explicites, sans doublon pour les liens retour.
4. Les champs personnalisés sont définis séparément de leurs valeurs. Les valeurs utilisent un stockage typé, plutôt qu’un JSON opaque unique, afin de permettre les filtres et recherches.
5. Les données et leur présentation sont séparées.
6. Les variantes locales et les branches alternatives réutilisent les contenus existants lorsque possible; elles enregistrent les différences plutôt que de copier automatiquement tout le contenu.
7. Suppression, archivage, statut de canon et statut de travail sont des notions distinctes.
8. Les fichiers et leurs usages sont séparés.
9. Les identifiants internes servent aux jointures; des identifiants publics stables sont utilisés pour l’import/export et les références externes.
10. Les changements de schéma sont ajoutés par de nouvelles migrations. Les migrations déjà appliquées ne sont jamais réécrites.

## 1. Projets et univers

### `projects`

- `id` — clé primaire.
- `public_id` — identifiant stable et unique pour l’import/export.
- `name` — nom du projet.
- `description` — description facultative.
- `settings` — paramètres de projet sérialisés, uniquement pour les préférences non relationnelles et non sensibles.
- `created_at`, `updated_at`, `deleted_at` — dates de création, modification et suppression réversible.

Contraintes : `public_id` unique. La suppression réversible ne doit pas supprimer automatiquement les contenus ou ressources partagés.

### `universes`

- `id`, `public_id` — clés.
- `name`, `description`.
- `settings` — préférences propres à l’univers.
- `created_at`, `updated_at`, `deleted_at`.

Contraintes : `public_id` unique. Un univers peut être référencé par plusieurs projets.

### `project_universe`

- `project_id`, `universe_id`.
- `usage_type` — rôle facultatif de l’association (par exemple univers principal ou univers complémentaire).
- `created_at`.

Contrainte : unicité du couple `project_id + universe_id`.

## 2. Types de contenu et contenus

### `content_types`

Définit les types comme personnage, lieu, document, idée, note de recherche ou tâche.

- `id`, `public_id`.
- `key` — identifiant technique stable.
- `name`, `description`.
- `scope_type` — système, global, univers ou projet.
- `project_id`, `universe_id` — portées facultatives, avec règle de cohérence.
- `is_system`, `is_active`.
- `created_at`, `updated_at`.

Les types système sont protégés. Les règles empêchent qu’un même type prétende appartenir simultanément à des portées incompatibles.

### `contents`

Table commune pour toutes les fiches et tous les documents.

- `id`, `public_id`.
- `content_type_id` — type de contenu.
- `title` — titre principal.
- `summary` — résumé facultatif.
- `work_status_key` — état de travail courant, à relier à une définition de statut configurable si nécessaire.
- `scope_type` — global, projet ou univers.
- `project_id`, `universe_id` — portées selon le type.
- `origin_content_id` — contenu source si ce contenu est une copie ou une conversion qui conserve une provenance.
- `created_at`, `updated_at`, `deleted_at`, `archived_at`.

Contraintes à établir : `public_id` unique; cohérence entre `scope_type` et les clés de portée; règles de suppression référentielle explicites. Les champs spécialisés ne sont pas tous ajoutés comme colonnes à cette table.

**Note de conception :** la portée du contenu, son emplacement dans un dossier, son appartenance à un projet et sa participation à une branche ne doivent pas être confondus. Un contenu peut être réutilisé sans être dupliqué.

### `content_blocks`

Blocs de texte libre indépendants des champs structurés.

- `id`, `public_id`.
- `content_id`.
- `block_type` — texte, citation, note ou type de bloc défini par l’éditeur.
- `title` — titre facultatif.
- `body` — contenu du bloc dans un format documenté et versionnable.
- `position` — ordre logique dans le contenu.
- `created_at`, `updated_at`, `deleted_at`.

Contrainte : index sur `content_id + position`. La disposition visuelle n’est pas stockée dans `body`.

## 3. Modèles et champs personnalisés

### Principes d'intégrité

- Une version publiée est immuable. Modifier la structure crée une nouvelle version.
- Les valeurs d'une fiche sont indépendantes de la version de modèle actuellement affichée.
- Retirer un champ d'une nouvelle version ne supprime ni sa définition ni les valeurs déjà enregistrées.
- Les définitions de champs utilisées historiquement ne sont pas supprimées physiquement. Une définition inutilisée peut être désactivée ou archivée.
- Un changement incompatible de type crée une nouvelle définition de champ; il ne change pas rétroactivement le sens des anciennes valeurs.
- La mise à jour d'une fiche vers une nouvelle version est explicite, prévisualisée et traçable.

### `content_templates`

- `id`, `public_id`, `name`, `description`.
- `content_type_id`.
- `scope_type`, `project_id`, `universe_id`.
- `base_template_id` — modèle parent si le modèle est une variante.
- `is_system`, `is_active`.
- `created_at`, `updated_at`, `deleted_at`.

Le modèle représente l'identité durable et la portée du modèle, pas sa structure à un instant précis. Les modèles système sont protégés; l'utilisateur peut les adapter en créant un modèle distinct.

### `template_versions`

- `id`, `template_id`.
- `version_number`.
- `change_summary`.
- `published_at` — nul tant que la version est un brouillon; une fois publiée, la version et sa structure deviennent immuables.
- `created_at`, `updated_at`.

Contrainte : unicité de `template_id + version_number`. Une version publiée est immuable. La structure exacte de chaque version est définie par ses lignes `template_version_fields` et les options de présentation qui y sont enregistrées. Éviter un second instantané structurel faisant autorité en parallèle de ces lignes. Si un instantané d'export ou de diagnostic est utile, il doit être explicitement dérivé et non servir de source concurrente.

### `field_definitions`

Définitions stables de champs réutilisables.

- `id`, `public_id`, `key`, `label`, `description`.
- `value_type` — l’un des types initiaux `text`, `number`, `boolean`, `date`, `choice`, `reference` ou `json`; toute extension doit ajouter sa validation et ses tests.
- `scope_type`, `project_id`, `universe_id`.
- `options_data` — options et contraintes propres au type, lorsque celles-ci ne nécessitent pas de relations dédiées.
- `created_at`, `updated_at`, `deleted_at`.

La clé technique et le type d'une définition utilisée ne sont pas modifiés rétroactivement. Le libellé canonique de la définition sert de nom par défaut; `label_override` permet à chaque modèle/version d'employer un libellé adapté sans modifier les autres modèles qui réutilisent le même champ. Un changement incompatible de type crée une nouvelle définition; une migration de valeur éventuelle doit être explicite et contrôlée. Les définitions retirées des modèles restent conservées afin que les anciennes valeurs gardent leur sens.

### `template_version_fields`

- `template_version_id`, `field_definition_id`.
- `section_key` — section logique.
- `position`.
- `is_required`.
- `default_value` — représentation JSON nullable d’une valeur par défaut, validée selon le type du champ par Laravel.
- `display_options` — présentation de ce champ dans cette version.
- `label_override` nullable — libellé propre à cette version si le modèle veut présenter différemment un champ partagé.
- `help_text` nullable — consigne propre à cette version.

Contrainte : unicité du couple `template_version_id + field_definition_id`, sauf si un besoin confirmé exige plusieurs occurrences d'un même champ. Les règles de présentation sont versionnées ici; elles ne modifient pas les valeurs de contenu.

### `content_field_values`

Valeurs conservées par contenu, indépendamment de la version de modèle affichée.

- `id`.
- `content_id`, `field_definition_id`.
- `value_text`, `value_number`, `value_boolean`, `value_date`, `value_json`, `reference_content_id`.
- `created_at`, `updated_at`.

Contrainte : unicité du couple `content_id + field_definition_id` pour les champs à valeur unique. Une seule colonne de valeur compatible avec le type est renseignée pour une valeur simple; cette règle est vérifiée par la validation Laravel et les tests. Les valeurs multivaluées ne sont pas implicitement encodées dans ces colonnes : leur représentation sera conçue avant de proposer ce comportement dans l'interface.

**Champ retiré d'un modèle :** enlever le champ de `template_version_fields` dans une nouvelle version ne supprime pas sa ligne dans `content_field_values`. La valeur est conservée et reste consultable dans une section « Champs retirés du modèle » de la fiche. Si le champ est réintroduit, Bifrost vérifie que la définition et le type sont compatibles avant de réutiliser cette valeur. Les valeurs ne sont supprimées qu'à la suite d'une action explicite de l'utilisateur.

Les valeurs typées permettent le filtrage et la recherche sans créer de colonne SQL pour chaque champ. `value_json` est réservé aux valeurs complexes qui ne doivent pas être filtrées comme des données relationnelles. Les références vers un contenu utilisent une clé étrangère; la cohérence des portées doit également être validée par l'application. Pour les champs de type référence, `options_data` peut préciser les types de contenus cibles autorisés et les règles de portée. La suppression réversible d'un contenu cible ne supprime pas la valeur de référence; l'interface signale que la cible est supprimée ou indisponible. La suppression définitive doit être bloquée ou traitée par une règle explicite afin de ne pas laisser une référence silencieusement cassée.

### `content_template_assignments`

- `id`.
- `content_id`.
- `template_id`, `template_version_id`.
- `assigned_at`.

Cette table représente l'affectation courante du modèle et de sa version à une fiche. Recommandation : une seule affectation courante par fiche, avec unicité de `content_id`; une fiche sans modèle n'a aucune ligne. L'application vérifie que `template_version_id` appartient bien à `template_id` et que le type et les portées du modèle sont compatibles avec le contenu. Ces vérifications doivent être couvertes par des tests d'intégrité. Une fiche sans modèle peut ne pas avoir d'affectation. Une nouvelle version de modèle ne remplace jamais cette association automatiquement.

### `content_template_update_events`

Historique des mises à jour de modèle explicitement appliquées à une fiche.

- `id`, `content_id`.
- `from_template_version_id` nullable pour la première affectation.
- `to_template_version_id`.
- `change_summary`.
- `change_data` — résumé structuré des champs ajoutés, retirés ou modifiés et du traitement choisi pour les valeurs.
- `applied_at`.

Cet historique permet d'expliquer quelle mise à jour a été appliquée et quand. Il ne remplace pas les valeurs conservées ni l'historique général des révisions de contenu.

### Mise à jour des modèles

Avant application, Bifrost compare les deux versions et prévisualise les champs ajoutés, retirés ou modifiés. L'utilisateur confirme la mise à jour. Les nouvelles valeurs par défaut ne remplacent pas les valeurs déjà saisies. Les valeurs de champs retirés sont conservées et consultables. Toute conversion de type est proposée explicitement; les valeurs non compatibles sont préservées jusqu'à résolution manuelle. Les blocs de texte libre (`content_blocks`) restent indépendants des modèles et ne sont pas modifiés par une mise à jour de modèle.


### Réutilisation des champs entre modèles

Une même définition peut être référencée par plusieurs lignes de `template_version_fields`, y compris dans des modèles différents, si sa portée autorise cet usage. La réutilisation partage l'identité et le type du champ, pas nécessairement son libellé d'affichage, son aide, sa section, son ordre ni son caractère obligatoire. Ces paramètres appartiennent à la version du modèle.

Règles de portée proposées :
- un champ système/global peut être utilisé par les modèles des portées autorisées;
- un champ propre à un univers ne peut être utilisé que dans cet univers et les projets qui y ont accès selon les règles de portée de Bifrost;
- un champ propre à un projet reste limité à ce projet;
- une version de modèle ne peut référencer qu'un champ dont la portée est compatible avec celle du modèle.

La compatibilité de portée entre modèles, définitions de champs et contenus doit être validée par Laravel et couverte par des tests; les clés étrangères seules ne suffisent pas à la garantir.

### Cohérence des valeurs et contraintes

- Une fiche ne possède qu'une valeur courante par définition de champ à valeur unique. Les valeurs multivaluées exigeront une structure dédiée avant leur prise en charge.
- La valeur doit utiliser une colonne compatible avec `value_type`; une valeur de référence doit utiliser `reference_content_id` et respecter les types de cible autorisés.
- L'affectation courante doit pointer vers une version appartenant réellement au modèle indiqué.
- Les versions publiées et leurs lignes `template_version_fields` ne sont pas modifiées en place; toute modification crée une nouvelle version.
- Les valeurs des champs absents de la version actuelle restent conservées et accessibles dans « Champs retirés du modèle ».
- Les blocs de texte libre demeurent indépendants des modèles et de leurs mises à jour.


### Contraintes techniques à fixer pour le lot 2 (SQLite/Laravel)

Cette section précise les contraintes à utiliser lors de la rédaction des migrations. Elle ne modifie aucune migration existante.

#### Identifiants, unicité et index

- Toutes les tables du lot 2 utilisent une clé primaire entière `id`. Les entités qui doivent être référencées à l’import/export (`content_templates` et `field_definitions`) ont aussi un `public_id` UUID unique. Les tables de liaison et d’historique n’ont pas besoin d’identifiant public tant qu’elles ne sont pas exposées comme objets importables.
- `template_versions` impose `UNIQUE(template_id, version_number)`.
- `template_version_fields` impose `UNIQUE(template_version_id, field_definition_id)` et un index pour retrouver rapidement les usages d’une définition de champ.
- `content_field_values` impose `UNIQUE(content_id, field_definition_id)`, car le premier lot ne prend en charge que les champs à valeur unique.
- `content_template_assignments` impose `UNIQUE(content_id)`, pour garantir une seule affectation courante par fiche.
- `content_template_update_events` est indexée par `content_id, applied_at`; les versions source et cible sont référencées par clés étrangères.

#### Clés étrangères et suppressions

- `content_templates.content_type_id` référence `content_types` avec suppression restrictive. Un type déjà utilisé ne doit pas être supprimé en cascade.
- `content_templates.base_template_id` est une auto-référence nullable, avec suppression restrictive. L’application vérifie l’absence de cycle et la compatibilité du modèle parent; la contrainte SQL seule ne suffit pas.
- `template_versions.template_id` référence `content_templates` avec suppression restrictive. Les versions publiées ne sont pas supprimées physiquement.
- `field_definitions.project_id` et `universe_id` suivent les mêmes règles de portée que les types de contenu : clés nulles pour les portées système/globales, une seule clé correspondante pour les portées projet/univers. Les suppressions sont restrictives.
- `template_version_fields.template_version_id` et `field_definition_id` sont des clés étrangères restrictives. Les lignes d’une version publiée ne sont pas modifiées en place; les changements sont portés par une nouvelle version.
- `content_field_values.content_id` et `field_definition_id` sont des clés étrangères restrictives au niveau SQL, afin qu’une suppression physique ne détruise pas silencieusement des valeurs. Les contenus utilisant normalement `SoftDeletes` restent restaurables; une purge définitive doit être une opération explicite.
- `content_field_values.reference_content_id` est nullable et référence `contents` avec suppression restrictive. Une cible supprimée de façon réversible reste donc référencée.
- `content_template_assignments.content_id`, `template_id` et `template_version_id` sont des clés étrangères restrictives. Laravel vérifie que la version appartient au modèle et qu’elle est publiée/valide pour l’affectation.
- `content_template_update_events.content_id`, `from_template_version_id` et `to_template_version_id` sont des clés étrangères restrictives; la version source peut être nulle pour une première affectation. L’historique ne doit pas disparaître parce qu’un modèle ou une version est retiré de l’interface.

#### Valeurs typées et valeurs par défaut

- `field_definitions.value_type` utilise une liste fermée de clés techniques initiales (texte, nombre, booléen, date, choix simple, référence et JSON si un besoin concret le justifie). Une clé inconnue est rejetée par Laravel.
- Pour `content_field_values`, Laravel valide qu’exactement une colonne de valeur est renseignée et qu’elle correspond au type de la définition. SQLite ne peut pas garantir à lui seul toutes les règles inter-tables; des tests d’intégrité sont obligatoires.
- Les valeurs de choix simples doivent utiliser une représentation clairement définie et validée. Les choix multiples et les champs multivalués sont hors périmètre.
- `default_value` ne doit pas être une chaîne SQL arbitraire. Recommandation : stocker une représentation JSON nullable de la valeur par défaut, puis la valider selon `value_type` dans Laravel. Elle sert de valeur initiale pour les nouvelles fiches, jamais à écraser une valeur existante.
- Pour une valeur de référence, seule `reference_content_id` est renseignée; la cible doit respecter les types et portées autorisés dans les options du champ.

#### Publication et immuabilité des versions

Le schéma actuel doit rendre l’état de publication explicite : ajouter `published_at` nullable à `template_versions`. Une version avec `published_at = NULL` est un brouillon modifiable; une version publiée est immuable. L’application doit empêcher la modification ou la suppression d’une version publiée et de ses lignes `template_version_fields`. Les affectations courantes ne peuvent pointer que vers une version publiée. Une version publiée est remplacée par une nouvelle version, jamais réécrite.

#### Portées et intégrité applicative

Les clés étrangères garantissent l’existence des enregistrements, mais pas que leurs portées sont compatibles. Avant toute affectation ou sauvegarde de valeur, Laravel doit vérifier :
- que le type de contenu du modèle correspond au contenu;
- que la portée du modèle et celle du contenu sont compatibles;
- que chaque champ est utilisable dans la portée du modèle;
- que chaque référence cible un type de contenu et une portée autorisés;
- que `template_version_id` appartient au `template_id` sélectionné;
- qu’aucun cycle n’existe dans `base_template_id`.

Ces règles doivent être testées au niveau des modèles/services et des requêtes de validation, pas seulement dans les migrations.

#### Transactions et historique de mise à jour

L’application d’une version doit se faire dans une transaction SQL : vérifier la version cible, calculer les changements, conserver toutes les valeurs, mettre à jour l’affectation courante et écrire `content_template_update_events`. En cas d’échec, aucune partie de l’opération ne doit rester appliquée. L’historique consigne l’action et les choix de traitement, sans dupliquer la valeur courante comme source de vérité.


## 4. Relations et références

### `content_relation_types`

- `id`, `key`, `name`, `description`.
- `scope_type`, `project_id`, `universe_id`.
- `directionality` — directionnelle ou symétrique.
- `rules_data` — règles optionnelles et validation.
- `created_at`, `updated_at`, `deleted_at`.

### `content_relations`

- `id`, `public_id`.
- `source_content_id`, `target_content_id`.
- `relation_type_id`.
- `properties_data` — propriétés facultatives de la relation.
- `created_at`, `updated_at`, `deleted_at`.

Contraintes : interdire une relation à elle-même sauf autorisation explicite; indexer source et cible; empêcher les doublons selon le type et les règles de direction. Pour une relation symétrique, normaliser la paire ou appliquer une règle équivalente afin d’éviter les doublons inversés. Les liens retour sont dérivés de ces lignes.

### `external_references`

- `id`, `source_content_id`.
- `reference_kind` — URL, identifiant importé ou référence externe.
- `target_public_id` — identifiant public connu si disponible.
- `target_label` — libellé de secours.
- `target_scope` — portée attendue si connue.
- `status` — valide, manquante ou à vérifier.
- `metadata`, `created_at`, `updated_at`.

Cette table sert aux références qui ne peuvent pas être résolues vers un contenu local valide. Les relations internes normales doivent utiliser les clés étrangères vers `contents`.

## 5. Variantes locales et branches

### `content_variants`

Représente une variante d’un contenu partagé dans une portée donnée.

- `id`, `public_id`.
- `base_content_id` — contenu partagé d’origine.
- `project_id` — projet dans lequel la variante est utilisée.
- `branch_id` — branche alternative facultative.
- `title_override`, `summary_override` — remplacements facultatifs si nécessaires.
- `created_at`, `updated_at`, `deleted_at`.

Contrainte : éviter deux variantes actives identiques pour le même contenu de base, projet et branche. Les champs non remplacés sont hérités du contenu de base.

### `content_variant_field_overrides`

- `id`, `content_variant_id`, `field_definition_id`.
- Colonnes de valeur typées équivalentes à `content_field_values`.
- `updated_at`.

Une ligne indique explicitement qu’une valeur est locale. L’absence de ligne signifie que la valeur est héritée. Réinitialiser une valeur supprime son remplacement local après confirmation si des données seraient perdues.

### `universe_branches`

- `id`, `public_id`.
- `universe_id`.
- `name`, `description`.
- `parent_branch_id` — branche d’origine ou parente si applicable.
- `status` — active, archivée ou fermée.
- `created_at`, `updated_at`, `deleted_at`.

### `branch_content_states`

- `id`, `branch_id`, `content_id`.
- `state_key` — inclus, modifié, exclu ou autre état validé.
- `title_override`, `summary_override` si la branche peut modifier ces champs directement.
- `created_at`, `updated_at`.

### `branch_field_overrides`

- `id`, `branch_id`, `content_id`, `field_definition_id`.
- Colonnes de valeur typées.
- `updated_at`.

### `content_canon_states`

- `id`, `content_id`.
- `branch_id` nullable pour le canon principal.
- `canon_status_key` — hypothèse, non confirmé, confirmé, retiré, etc.
- `changed_at`, `change_note`.

Contrainte : une seule valeur canonique courante par contenu et contexte de canon. Si l’historique des transitions canoniques est requis, les changements doivent également être consignés dans l’historique des modifications.

**À valider avant migrations :** décider si les variantes locales et les branches partagent une abstraction commune de « contexte de contenu » ou restent séparées. La proposition les distingue pour faciliter la compréhension, mais une implémentation plus unifiée pourrait réduire les doublons techniques. Ce point doit être tranché par revue du schéma, pas par une nouvelle série de questions isolées.

## 6. Dossiers, placements et favoris

### `folders`

- `id`, `public_id`, `name`.
- `scope_type`, `project_id`, `universe_id`.
- `parent_folder_id`.
- `created_at`, `updated_at`, `deleted_at`.

### `content_placements`

- `id`, `content_id`, `folder_id`.
- `placement_type` — emplacement principal ou raccourci.
- `created_at`.

Contraintes : un seul emplacement principal actif par contenu dans sa portée; plusieurs raccourcis possibles. Le déplacement de l’emplacement principal ne supprime pas les raccourcis.

### `tags` et `content_tag`

`tags` contient l’identité, le libellé et la portée de chaque étiquette, ainsi qu’un éventuel `parent_tag_id` pour les étiquettes hiérarchiques. `content_tag` relie les étiquettes aux contenus.

Contraintes : unicité normalisée du libellé dans une portée appropriée; fusion et remplacement doivent préserver les associations.

### `favorites` et `saved_views`

Les favoris et raccourcis devraient être représentés par une table de favoris avec une cible typée ou une table de raccourcis si plusieurs types de cibles sont nécessaires. Les vues enregistrées stockent des critères structurés versionnés (filtres, tri, colonnes, groupement, disposition) et une portée globale, projet ou univers. Ne pas encoder une requête SQL arbitraire dans une vue.

## 7. Historique, corbeille et restauration

### `content_revisions`

- `id`, `content_id`, `revision_number`.
- `snapshot_data` — état restaurable des champs et métadonnées.
- `change_summary`, `created_at`.

Contrainte : unicité de `content_id + revision_number`. Le texte riche peut nécessiter une stratégie de versionnement spécialisée si le volume devient important.

### `change_events`

- `id`.
- `entity_type`, `entity_public_id`.
- `action_key`, `summary`.
- `before_data`, `after_data` selon les règles de confidentialité.
- `created_at`.

Cette table sert à la traçabilité des changements importants et à la reconstruction d’un diagnostic; elle ne remplace pas nécessairement les instantanés complets de révision.

### Suppression et restauration

Les colonnes `deleted_at` ne suffisent pas à elles seules pour restaurer toutes les dépendances. Lors d’une suppression, enregistrer les liens et placements qui doivent pouvoir être restaurés, ou conserver leurs lignes avec un état supprimé. Le schéma final doit garantir que restaurer un contenu ne réactive pas automatiquement des liens incompatibles avec l’état actuel; les conflits sont signalés et résolus explicitement.

## 8. Ressources

### `resources`

- `id`, `public_id`.
- `storage_mode` — importé ou externe.
- `original_name`, `mime_type`, `size_bytes`.
- `managed_path` — chemin relatif interne si importé.
- `external_path` — chemin ou URI externe si référencé.
- `content_hash` — empreinte pour détecter doublons et corruption si disponible.
- `availability_status` — disponible, manquant ou à vérifier.
- `created_at`, `updated_at`, `deleted_at`.

Les chemins absolus dépendant d’un ordinateur ne doivent pas être l’unique identité de la ressource; les références externes peuvent devenir invalides lors d’un transfert.

### `resource_usages`

- `id`, `resource_id`, `content_id`.
- `usage_type`, `label`, `position`, `metadata`.
- `created_at`.

Une ressource peut avoir plusieurs usages. Avant suppression d’un fichier importé, vérifier qu’aucun usage actif ne le référence. Le stockage des fichiers doit être coordonné avec les transactions SQL et les opérations de sauvegarde.

## 9. Chronologies

### `timeline_definitions`

- `id`, `public_id`, `name`, `description`.
- `scope_type`, `project_id`, `universe_id`, `branch_id`.
- `created_at`, `updated_at`.

### `timeline_items`

- `id`, `timeline_id`.
- `content_id` nullable si l’élément représente un contenu existant; sinon l’élément doit pouvoir être converti en contenu sans perdre ses données.
- `label`, `notes`.
- `temporal_kind` — instant, intervalle, période ou marqueur narratif.
- `start_value`, `end_value` — représentation normalisée des valeurs temporelles si présentes.
- `precision_key`, `narrative_marker`.
- `position`, `created_at`, `updated_at`.

Les valeurs temporelles et leur précision doivent être représentées sans forcer les dates inconnues dans une date SQL artificielle. Le format exact des valeurs devra être fixé lors du détail technique.

### `timeline_order_relations`

- `id`, `before_item_id`, `after_item_id`.
- `relation_type`, `created_at`.

Les relations d’ordre doivent empêcher les liens contradictoires ou les cycles lorsque l’ordre est censé être strict. Un même événement peut apparaître dans plusieurs chronologies sans dupliquer le contenu source.

## 10. Recherche, idées, tâches et objectifs

- **Recherche :** les notes de recherche restent des contenus; les sources documentaires et citations ont des tables spécialisées afin qu’une source réutilisée ne soit pas dupliquée.
- **`research_sources` :** type de source, titre, auteur, éditeur, date, URL ou identifiant bibliographique, métadonnées.
- **`source_excerpts` :** source, texte cité ou paraphrase, indicateur exact/paraphrase, emplacement (page, chapitre, horodatage, URL), commentaire et lien facultatif vers un contenu.
- **Idées :** représentées par le type de contenu, avec provenance et statut de travail.
- **Tâches :** table spécialisée `tasks` liée à un contenu commun, ou champs spécialisés de tâche si l’usage demeure simple; statut, priorité, échéance facultative et dates.
- **`content_tasks` :** association de tâches aux contenus si une tâche peut concerner plusieurs contenus.
- **`goals` et `goal_links` :** objectifs facultatifs, statut, échéance facultative et liens vers tâches/contenus.
- **Rappels et notifications :** à ajouter après les fondations, sans les rendre nécessaires au modèle initial des contenus.

## 11. Paramètres et sécurité

Les préférences globales, de projet et d’univers doivent avoir une priorité de résolution claire : valeur locale explicite, puis valeur globale par défaut. Les préférences simples peuvent être sérialisées; les données relationnelles ne doivent pas être cachées dans un champ de paramètres.

Le verrouillage d’interface n’est pas un substitut au chiffrement. Les mécanismes de chiffrement, stockage des clés, récupération et protection des sauvegardes nécessitent une conception de sécurité séparée avant leur implémentation. Les journaux doivent exclure par défaut le texte complet des projets et les secrets.

## 12. Ordre de réalisation recommandé

### Fondations initiales

1. Projets, univers et associations.
2. Types de contenu, contenus, blocs de texte.
3. Modèles, versions, définitions de champs et valeurs typées.
4. Relations et références externes.
5. Dossiers, placements et étiquettes.
6. Ressources et usages.
7. Historique minimal et suppression/restauration.
8. Tests d’intégrité et de migration.

### Après validation des fondations

- Variantes locales et branches alternatives complètes.
- Chronologies multi-échelles.
- Sources de recherche et extraits.
- Tâches, objectifs et rappels.
- Historique rédactionnel avancé, disposition libre, espaces de travail et notifications.
- Chiffrement local, fonctions expérimentales et migration complète d’environnement.

Reporter l’interface avancée ne signifie pas abandonner ces fonctions. Le modèle initial doit simplement éviter de les rendre impossibles.

## 13. Cas de validation obligatoires

Avant d’approuver les migrations, vérifier conceptuellement et par tests que le schéma permet :

1. Un même univers utilisé dans deux projets.
2. Un contenu partagé avec une variante locale dont un champ diffère, sans modifier l’original.
3. Une branche alternative qui modifie le statut canonique d’un contenu sans affecter le canon principal.
4. Une idée convertie en fiche en conservant sa provenance et son historique.
5. Une relation entre deux contenus affichée dans les deux sens sans ligne dupliquée.
6. Un contenu supprimé puis restauré avec ses liens et placements, tout en signalant les conflits.
7. Une ressource utilisée par plusieurs contenus, dont un est supprimé sans supprimer la ressource encore utilisée.
8. Un champ personnalisé filtrable et recherchable, avec validation de son type.
9. Une mise à jour de modèle proposée sans écraser une valeur personnalisée.
11. Le retrait d'un champ dans une nouvelle version conserve la valeur de la fiche et permet de la consulter; un changement incompatible de type ne réinterprète pas cette ancienne valeur.
12. Un champ partagé entre plusieurs modèles conserve une identité et un type stables, tandis que le libellé d'affichage et les règles de présentation peuvent différer selon la version du modèle.
13. Une affectation de modèle référence une version appartenant à ce modèle; les champs réutilisés et les références de contenu respectent les règles de portée et de type.
10. Un événement imprécis ou sans date exacte placé dans une chronologie sans date inventée.

## Points à trancher lors de la revue du schéma

1. Confirmer la stratégie d’héritage des variantes et des branches : tables séparées comme proposé ou abstraction commune de contexte.
2. Confirmer quelles fonctions doivent faire partie du premier ensemble de migrations et lesquelles attendront, notamment branches, chronologies et révisions avancées.
3. Confirmer le moteur de base de données cible et ses contraintes concrètes avant de fixer les types SQL, index et contraintes complexes.

Ces trois points seront présentés avec une recommandation technique et leurs conséquences. Ils ne doivent pas déclencher une longue nouvelle série de questions indépendantes.


## 14. Revue technique et recommandations

Cette section transforme les points ouverts en recommandations de travail. Elle ne crée pas de migration et ne remplace pas une validation fonctionnelle.

### Moteur de base de données : SQLite

Le dépôt configure déjà SQLite comme moteur par défaut dans `config/database.php` et `.env.example`. Bifrost étant local d’abord, **conserver SQLite pour la première version** est le choix le plus simple : aucun serveur de base de données séparé à installer ou à maintenir.

Conséquences techniques :
- utiliser des clés étrangères et activer leur vérification;
- privilégier les contraintes et index compatibles avec SQLite et les migrations Laravel;
- stocker les structures JSON uniquement pour les options réellement flexibles, sans y cacher les données à filtrer ou à relier;
- tester les migrations et les contraintes sur SQLite, pas seulement sur un autre moteur;
- éviter les fonctionnalités SQL propres à un serveur tant qu’un besoin concret ne les justifie pas.

### Variantes et branches : concepts séparés, primitives partagées

**Recommandation : garder les tables de variantes et de branches distinctes dans le modèle métier.** Une variante locale répond à la question « quelle valeur ce projet personnalise-t-il? »; une branche répond à « quel état alternatif de l’univers est exploré? ». Les fusionner en une seule table polymorphe rendrait les règles de portée, de canon et d’héritage plus difficiles à valider.

En revanche, les implémentations peuvent partager du code de validation et de résolution des valeurs héritées. Éviter une table polymorphe générique de contexte pour la première version : elle compliquerait les clés étrangères et l’intégrité référentielle.

Avant les migrations, clarifier une règle importante : si un contenu possède à la fois une variante locale et un état dans une branche, l’ordre de résolution doit être explicite. Proposition : contenu de base, puis variante locale du projet, puis remplacement propre à la branche; une valeur absente à un niveau hérite du niveau précédent. Les tests devront couvrir les conflits entre ces niveaux.

### Périmètre des migrations : fondations par étapes

Ne pas créer toutes les tables proposées en une seule vague. Les migrations existantes pour les projets et les tags doivent être conservées et étendues par de nouvelles migrations. Les étapes recommandées sont :

1. **Socle de contenu :** univers et association projet-univers, types de contenu, contenus et blocs de texte.
2. **Structure réutilisable :** modèles/versionnements, définitions de champs et valeurs typées, relations entre contenus.
3. **Organisation :** placements/dossiers et extension du système de tags existant pour les contenus sans casser les associations de projets.
4. **Fiabilité :** ressources et usages, révisions minimales, suppression/restauration et tests d’intégrité.
5. **Fonctions avancées ensuite :** variantes locales et branches, chronologies, recherche documentaire, tâches/objectifs, historique détaillé et notifications.

Cette séquence ne signifie pas que les fonctions avancées sont abandonnées. Elle réduit le risque d’introduire d’un coup des règles d’héritage, de canon et de restauration avant que le socle de contenu soit testé.

### Corrections à intégrer avant d’écrire les migrations

- **Statuts configurables :** remplacer les seules clés libres telles que `work_status_key` et `canon_status_key` par des définitions de statuts configurables, ou définir clairement qu’elles sont des clés système fixes dans la première version. Ne pas laisser une chaîne arbitraire devenir un statut valide.
- **Valeurs de champs :** documenter la règle « une seule colonne de valeur renseignée » et la faire respecter par la validation applicative et les tests. Les valeurs multivaluées et les références doivent avoir un modèle précis avant d’être utilisées.
- **Version de modèle :** l’association du contenu doit référencer la version exacte utilisée; la table de liaison doit empêcher plusieurs affectations actives contradictoires.
- **Canon :** `content_canon_states` doit représenter l’état courant sans ambiguïté. L’historique des transitions doit être conservé séparément, plutôt que de dépendre d’une seule date `changed_at`.
- **Suppression/restauration :** définir précisément quelles associations sont conservées et lesquelles sont marquées supprimées. Les clés étrangères seules ne peuvent pas garantir une restauration cohérente des liens et placements.
- **Identifiants et portée :** toute clé étrangère doit respecter la portée autorisée. Les règles impliquant plusieurs tables nécessiteront des validations Laravel et des tests, car une simple clé étrangère ne garantit pas à elle seule la cohérence entre `scope_type`, `project_id` et `universe_id`.
- **Favoris et vues :** éviter les cibles polymorphes non contraintes si une table d’association typée peut assurer une meilleure intégrité. La forme exacte de ces tables peut attendre la fonctionnalité concernée.

### Décision de revue proposée

Pour avancer sans rouvrir chaque choix fonctionnel, utiliser les paramètres suivants comme base technique :
- SQLite pour le développement local et les tests;
- variantes et branches séparées dans le schéma métier, avec règles d’héritage explicites;
- migrations en plusieurs étapes, en conservant toutes les migrations historiques;
- aucune migration de branche ou de chronologie avant que le socle de contenu et ses tests d’intégrité soient en place.

Ces recommandations restent révisables avant implémentation; elles ne modifient pas les données existantes.
