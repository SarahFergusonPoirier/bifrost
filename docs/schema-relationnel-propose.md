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

### `content_templates`

- `id`, `public_id`, `name`, `description`.
- `content_type_id`.
- `scope_type`, `project_id`, `universe_id`.
- `base_template_id` — modèle parent si le modèle est une variante.
- `is_system`, `is_active`.
- `created_at`, `updated_at`, `deleted_at`.

### `template_versions`

- `id`, `template_id`.
- `version_number`.
- `change_summary`.
- `snapshot_data` — instantané complet et versionné de la structure du modèle, incluant la composition des sections/champs et les règles de présentation.
- `created_at`.

Contrainte : unicité de `template_id + version_number`. Une version publiée est immuable; les changements produisent une nouvelle version.

### `field_definitions`

Définitions de champs réutilisables.

- `id`, `public_id`, `key`, `label`, `description`.
- `value_type` — texte, nombre, booléen, date, choix, référence, etc.
- `scope_type`, `project_id`, `universe_id`.
- `options_data` — options et contraintes spécifiques au type de champ.
- `created_at`, `updated_at`, `deleted_at`.

Les clés techniques des champs restent stables même si le libellé change. Une modification incompatible du type de valeur nécessite une migration de données contrôlée.

### `template_version_fields`

- `template_version_id`, `field_definition_id`.
- `section_key` — section logique.
- `position`.
- `is_required`.
- `default_value` — valeur par défaut si compatible avec le type.
- `display_options` — paramètres de présentation non liés à la valeur.

Contrainte : unicité de `template_version_id + field_definition_id), sauf si le produit autorise explicitement plusieurs occurrences d’un même champ.

### `content_field_values`

Valeurs des champs d’un contenu.

- `id`.
- `content_id`, `field_definition_id`.
- `value_text`, `value_number`, `value_boolean`, `value_date`, `value_json`, `reference_content_id`.
- `updated_at`.

Une seule colonne de valeur compatible avec le type de champ doit être renseignée pour une valeur simple. Des tables dédiées pourront être ajoutées pour les valeurs multivaluées si le besoin est confirmé. Des contraintes applicatives et tests vérifient que le type et la colonne utilisée concordent.

Cette approche hybride garde les champs filtrables et indexables sans créer une colonne SQL pour chaque nouveau champ. Les valeurs structurées complexes ne doivent utiliser `value_json` que lorsque les requêtes attendues le permettent.

### `content_template_assignments`

- `content_id`.
- `template_id`, `template_version_id`.
- `assigned_at`.

Garde la trace du modèle et de sa version utilisés par le contenu. Une nouvelle version de modèle ne remplace pas automatiquement cette association.

### Mise à jour des modèles

L’application doit comparer la version utilisée et la nouvelle version, présenter les champs ajoutés/modifiés/supprimés, détecter les valeurs locales et conflits, puis enregistrer une application explicite de la mise à jour. Un journal de changement doit permettre de comprendre ce qui a été appliqué.

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
10. Un événement imprécis ou sans date exacte placé dans une chronologie sans date inventée.

## Points à trancher lors de la revue du schéma

1. Confirmer la stratégie d’héritage des variantes et des branches : tables séparées comme proposé ou abstraction commune de contexte.
2. Confirmer quelles fonctions doivent faire partie du premier ensemble de migrations et lesquelles attendront, notamment branches, chronologies et révisions avancées.
3. Confirmer le moteur de base de données cible et ses contraintes concrètes avant de fixer les types SQL, index et contraintes complexes.

Ces trois points seront présentés avec une recommandation technique et leurs conséquences. Ils ne doivent pas déclencher une longue nouvelle série de questions indépendantes.
