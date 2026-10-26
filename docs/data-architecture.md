# Architecture des données de Bifrost

## Objectif

Ce document fixe les principes et les concepts du modèle de données avant la création des migrations et modèles des futurs outils. Le bilan fonctionnel consolidé se trouve dans [Bilan des décisions d’architecture](bilan-decisions-architecture.md).

Les migrations historiques restent immuables : toute évolution du schéma passe par une nouvelle migration.

## Concepts fondamentaux

- **Projet** : espace de travail autonome contenant des contenus, ressources et outils. Un projet peut référencer plusieurs univers.
- **Univers** : ensemble cohérent d’éléments réutilisables. Un univers est indépendant d’un projet et peut être partagé entre plusieurs projets.
- **Contenu** : unité de données identifiable possédant une identité, des métadonnées, un statut de travail, un statut canonique, des liens et un historique. Les types spécialisés incluent notamment les fiches, documents, notes de recherche, idées et tâches.
- **Type de contenu** : définit la spécialisation d’un contenu et les champs structurés qu’il utilise. Ne pas créer une table distincte pour chaque type de fiche.
- **Modèle** : définition réutilisable des champs, sections, règles et présentation d’un type de contenu.
- **Version de modèle** : instantané versionné d’un modèle utilisé par un contenu. Une mise à jour de modèle est proposée et appliquée explicitement; elle ne remplace pas silencieusement les données existantes.
- **Bloc de texte** : contenu rédactionnel libre indépendant pouvant coexister avec les champs structurés. La présentation ne doit pas être confondue avec le stockage du texte.
- **Ressource** : fichier importé dans la bibliothèque de Bifrost ou référence vers un fichier externe. Une ressource est distincte de ses utilisations.
- **Étiquette** : classification transversale, distincte du type de contenu et des relations.
- **Relation** : lien explicite entre deux contenus identifiés, éventuellement typé et doté de propriétés.
- **Variante locale** : adaptation d’un contenu partagé dans un projet, qui conserve la référence à l’original et distingue les valeurs héritées des valeurs locales.
- **Branche** : version alternative d’un univers ou d’un ensemble de contenus, qui réutilise les éléments inchangés et isole son propre état canonique.

## Portées des données

Chaque élément partageable doit avoir une portée explicite plutôt que de déduire sa portée à partir de son nom ou de son emplacement.

- **Globale** : disponible dans toute l’application, par exemple les modèles et définitions de champs globaux.
- **Projet** : associé à un projet et non visible automatiquement ailleurs.
- **Univers** : associé à un univers et réutilisable par les projets autorisés.
- **Variante locale** : adaptation propre à un projet d’un élément partagé.
- **Branche** : contexte alternatif dans lequel les contenus et leur statut canonique peuvent différer de la branche principale.

Les liens entre projets et univers doivent permettre plusieurs associations sans imposer que tous les contenus d’un projet deviennent partagés. Lorsqu’un contenu est réutilisé dans un autre espace, il faut distinguer référence partagée, copie indépendante et variante locale.

Une variante locale ne doit pas modifier silencieusement l’original. Le schéma détaillé doit permettre d’identifier les champs hérités et locaux et de réinitialiser une valeur locale vers la valeur héritée.

## Identifiants et relations

- Les clés primaires internes servent aux jointures et aux contraintes de base de données.
- Les entités référencées par d’autres contenus doivent aussi posséder un identifiant public stable, indépendant de leur titre et de leur emplacement.
- Une relation est une donnée explicite avec une source, une cible, un type et, au besoin, des propriétés structurées.
- Les relations peuvent être typées, directionnelles ou non selon leur définition. Les liens retour sont calculés à partir de la relation stockée, sans ligne dupliquée.
- Les mentions dans du texte restent du texte tant qu’elles ne sont pas converties explicitement en liens.
- Les références peuvent traverser les projets et univers lorsque leur portée le permet.
- Les références manquantes doivent être représentables pour les imports, les contenus incomplets et les suppressions conservant un lien historique. Elles doivent être distinguées d’une relation valide.
- Les noms et titres ne sont jamais des identifiants de relation.

## Contenus, statuts et transformations

Les fiches, documents, notes de recherche, idées et autres contenus partagent une base commune de métadonnées et de relations, avec des données spécialisées lorsque nécessaire.

Le statut de travail est indépendant du statut canonique. Un contenu terminé n’est pas automatiquement canonique; retirer un contenu du canon ne le supprime pas. Le statut canonique peut être défini pour le canon principal et pour chaque branche alternative.

Les conversions entre types de contenu doivent préserver le texte d’origine, les métadonnées pertinentes, les relations et la provenance. Le schéma doit distinguer une conversion d’une création de copie liée. Une idée peut ainsi être convertie en un ou plusieurs contenus, ou rester présente et liée à des contenus créés séparément.

## Modèles, champs et dispositions

Les modèles et définitions de champs peuvent être globaux, propres à un projet ou propres à un univers. Les modèles système sont protégés; l’utilisateur peut en créer des variantes ou des copies.

Les définitions de champs peuvent être réutilisées entre modèles, spécifiques à un modèle ou exceptionnelles à un seul contenu. Les clés techniques des champs doivent rester stables même si leur libellé change.

Les modèles sont versionnés. Chaque contenu doit garder la référence à la version utilisée. Les mises à jour sont prévisualisées et appliquées au choix, avec détection des conflits et sans perte silencieuse de données.

Les valeurs des champs peuvent être héritées d’un contenu partagé ou remplacées localement. La stratégie technique de stockage des champs personnalisés (par exemple, valeurs relationnelles typées, JSON validé ou approche hybride) doit être comparée avant la première migration qui la met en place. Elle doit prendre en charge les filtres, la recherche, les types de données, les variantes locales et l’évolution des modèles.

La présentation est distincte des données. Le mode structuré et le mode de disposition libre doivent modifier la manière d’afficher les mêmes données, pas dupliquer leur contenu. Les dispositions réutilisables et les adaptations propres à une fiche doivent être représentées séparément des valeurs de contenu.

## Texte et historique

Un contenu peut avoir un texte principal et plusieurs blocs de texte libres. Le stockage du texte doit être indépendant de la disposition visuelle afin que le changement de modèle ou de mode d’affichage ne fasse pas perdre le texte.

Les liens explicites vers d’autres contenus peuvent être enregistrés dans le texte. Les suggestions de correspondance basées sur les noms ne créent jamais automatiquement une relation.

L’historique détaillé est requis pour les textes et les changements importants. Le modèle doit permettre la restauration sélective de valeurs, relations et emplacements, avec signalement des conflits lorsqu’un contenu a changé depuis la version sauvegardée.

## Suppression, corbeille, archivage et doublons

La suppression de contenus doit être réversible au moyen d’une corbeille et préserver assez d’informations pour présenter les dépendances et restaurer les relations lorsque demandé. Avant une suppression, l’utilisateur choisit de conserver des références manquantes ou de retirer les liens concernés.

L’archivage est distinct de la suppression et du statut canonique. Il peut s’appliquer à un élément ou à un groupe et doit permettre de choisir si les relations restent actives ou deviennent des références historiques.

Les doublons potentiels sont détectés et présentés pour comparaison. Aucune fusion ou liaison automatique n’est permise. Une fusion assistée doit être réversible et laisser l’utilisateur choisir les valeurs, textes, relations et ressources conservés.

## Métadonnées, étiquettes, vues et recherche

Les métadonnées standards et les propriétés personnalisées typées doivent pouvoir être recherchées et filtrées. Les étiquettes peuvent être simples ou hiérarchiques, réutilisées entre projets et univers, et gérées avec contrôle des usages, remplacement global et fusion des doublons.

Les vues enregistrées conservent leurs filtres, tris, colonnes, groupements et dispositions. Elles et les recherches enregistrées peuvent être définies à portée globale, univers ou projet.

La recherche plein texte doit pouvoir fournir des extraits et ouvrir le document à l’endroit exact de la correspondance. Le périmètre de recherche peut inclure ou exclure projets, univers, types de contenu, champs et espaces.

## Chronologies et branches

Les informations temporelles doivent permettre les dates exactes ou approximatives, les périodes, les intervalles, les marqueurs narratifs libres et les relations d’ordre lorsque les dates sont inconnues. Ne jamais inventer une date pour forcer un ordre.

Un événement peut être affiché dans plusieurs chronologies sans être dupliqué. La représentation des branches doit permettre de réutiliser le contenu inchangé, de stocker les variantes et d’isoler le canon de chaque branche. La comparaison et la réintégration des changements sont sélectives; aucune branche ne doit écraser automatiquement le canon principal.

## Ressources et persistance des fichiers

Un fichier importé et une référence externe doivent être clairement distingués. Une ressource est stockée séparément de ses usages afin qu’un même fichier puisse être associé à plusieurs contenus.

La suppression d’un contenu ne doit pas supprimer un fichier encore utilisé ailleurs. Prévoir la détection des fichiers manquants, les collisions de noms et la protection contre les suppressions accidentelles.

Les fichiers ne participent pas aux transactions SQL : enregistrer les nouveaux fichiers avant de supprimer les anciens, puis nettoyer les nouveaux fichiers si la transaction échoue. Ne supprimer un fichier ancien qu’après confirmation que la mise à jour en base a réussi.

## Sauvegardes, sécurité et diagnostics

Les sauvegardes doivent pouvoir être intégrales ou ciblées, avec conservation configurable et possibilité de protéger certaines versions. Elles doivent vérifier leur intégrité et signaler les ressources externes omises. Une sauvegarde incomplète ne doit pas être présentée comme complète.

Le transfert doit prendre en charge l’export/import de projets et la migration complète de l’environnement. Les mises à jour de l’application nécessitent une sauvegarde préalable et des migrations contrôlées.

Le verrouillage d’un contenu et le chiffrement des données sont des fonctions de sécurité distinctes. Cacher un contenu dans l’interface ne suffit pas à le protéger sur disque. Le chiffrement des sauvegardes exportées est prévu; le chiffrement local peut être facultatif. La gestion des clés et la récupération doivent être conçues sans promettre de récupérer des données chiffrées en l’absence de clé valide.

Les diagnostics doivent détecter les incohérences et proposer des réparations réversibles. Les journaux sont configurables et les rapports exportés doivent éviter d’exposer inutilement le contenu des projets.

## Migrations et cohérence

1. Ne jamais réécrire une migration déjà appliquée sur une base existante.
2. Ajouter une migration versionnée pour chaque changement de schéma.
3. Prévoir les étapes de retour arrière quand elles sont sûres; documenter les changements irréversibles.
4. Avant toute suppression ou conversion, vérifier les données existantes et prévoir une migration de données explicite.
5. Ajouter des contraintes uniques, clés étrangères et règles de suppression intentionnelles.
6. Tester les migrations sur une base vide et, lorsque pertinent, sur une base contenant les données de la version précédente.
7. Ne pas supposer que toutes les installations locales ont exactement le même état sans vérifier la table `migrations`.
8. Valider toutes les données entrantes côté serveur; la validation cliente sert uniquement à guider l'utilisateur.
9. Utiliser une transaction lorsque plusieurs écritures de base de données forment une seule opération logique.
10. Tester les erreurs et les échecs de persistance pour vérifier que l’état antérieur reste intact autant que possible.

## Ordre de travail recommandé

1. Valider le modèle commun des contenus, les portées et les relations.
2. Choisir la représentation technique des champs personnalisés, versions de modèles, variantes et branches.
3. Définir les structures nécessaires à l’historique, la corbeille et les ressources.
4. Proposer et valider le schéma relationnel initial.
5. Ajouter ensuite les migrations, modèles Eloquent, règles de validation et tests d’intégrité.

Aucune migration ne doit être créée avant la validation du schéma détaillé.
