# Architecture des données de Bifrost

## Objectif

Ce document définit les règles de conception des données avant l'ajout des outils de création. Les migrations historiques restent immuables : toute évolution du schéma passe par une nouvelle migration.

## Concepts fondamentaux

- **Projet** : espace de travail autonome qui contient des fiches, documents, ressources et outils. Il peut être associé à un univers partagé.
- **Univers partagé** : ensemble cohérent d'éléments réutilisables par plusieurs projets. Il ne remplace pas les projets et ne force pas tous leurs contenus à être communs.
- **Œuvre / production** : création produite dans un projet (roman, jeu vidéo, scénario, etc.). Un projet peut contenir plusieurs productions.
- **Fiche** : élément structuré identifiable (personnage, lieu, faction, objet, concept, etc.). Son type détermine son modèle de champs, sans imposer une structure distincte par type.
- **Type de fiche** : définition réutilisable des champs et de leur présentation.
- **Document** : contenu rédactionnel libre ou structuré, distinct d'une fiche.
- **Ressource** : fichier importé ou référence externe associée à un projet, une fiche ou un document.
- **Modèle réutilisable** : définition globale ou limitée à un projet, réutilisable pour créer des fiches ou documents.
- **Étiquette** : classification légère et transversale. Elle ne remplace ni les types ni les relations.
- **Relation** : lien explicite entre deux éléments identifiés, éventuellement typé et doté de propriétés.

## Portée des données

Chaque élément partageable doit avoir une portée explicite plutôt que de déduire sa portée à partir de son nom ou de son emplacement.

- **Globale** : disponible dans toute l'application, par exemple les modèles globaux.
- **Projet** : appartient à un seul projet et n'est pas automatiquement visible ailleurs.
- **Partagée** : appartient à un univers partagé et peut être référencée depuis plusieurs projets.
- **Variante locale** : adaptation d'un élément partagé dans un projet donné.

Une variante locale doit conserver une référence à l'élément partagé d'origine et enregistrer uniquement les différences nécessaires. Elle ne doit pas modifier silencieusement l'original. Le comportement exact de résolution des champs partagés et locaux devra être défini avant d'implémenter l'édition des fiches.

## Identifiants et relations

- Les clés primaires internes servent aux jointures et aux contraintes de base de données.
- Les entités référencées par d'autres contenus doivent aussi posséder un identifiant public stable, indépendant de leur titre et de leur emplacement.
- Une relation est une donnée explicite avec une entité source, une entité cible, un type et, au besoin, des propriétés structurées.
- Les mentions dans du texte restent du texte tant qu'elles ne sont pas converties explicitement en liens.
- Les références invalides doivent être détectables. Une suppression ne doit pas transformer silencieusement une relation en relation vers une autre entité.
- Les références manquantes devront être représentables pour les imports et les contenus incomplets; elles doivent être distinguées d'une relation valide.
- Les noms et titres ne sont jamais des identifiants de relation.

## Métadonnées et propriétés personnalisées

Les champs structurants et fréquemment filtrés doivent rester des colonnes relationnelles explicites. Les propriétés définies par l'utilisateur peuvent être stockées dans une structure JSON validée par le type de fiche. Les clés de propriétés doivent être stables et indépendantes de leur libellé affiché, afin de permettre le renommage et l'évolution des modèles.

Les étiquettes restent une association réutilisable avec des règles d'unicité explicites. Éviter de dupliquer une étiquette simplement parce que la casse ou les espaces diffèrent.

## Migrations et compatibilité

1. Ne jamais réécrire une migration déjà appliquée sur une base existante.
2. Ajouter une migration versionnée pour chaque changement de schéma.
3. Prévoir les étapes de retour arrière quand elles sont sûres; documenter les changements irréversibles.
4. Avant toute suppression ou conversion, vérifier les données existantes et prévoir une migration de données explicite.
5. Ajouter des contraintes uniques, clés étrangères et règles de suppression intentionnelles.
6. Tester les migrations sur une base vide et, lorsque pertinent, sur une base contenant les données de la version précédente.
7. Ne pas supposer que toutes les installations locales ont exactement le même état sans vérifier la table `migrations`.

## Persistance et cohérence

- Valider toutes les données entrantes côté serveur; la validation cliente sert uniquement à guider l'utilisateur.
- Utiliser une transaction lorsque plusieurs écritures de base de données forment une seule opération logique.
- Les fichiers ne participent pas aux transactions SQL : enregistrer les nouveaux fichiers avant de supprimer les anciens, puis nettoyer les nouveaux fichiers si la transaction échoue.
- Ne supprimer un fichier ancien qu'après confirmation que la mise à jour en base a réussi.
- Les erreurs doivent laisser l'état antérieur intact autant que possible et être testées.
- Les opérations de synchronisation de relations doivent être atomiques avec l'enregistrement de l'entité concernée.

## Ordre d'implémentation

1. Valider ce modèle conceptuel et les portées des données.
2. Créer les migrations des entités fondamentales et de leurs relations.
3. Ajouter les modèles Eloquent, les contraintes et les règles de suppression.
4. Encadrer les opérations multi-écritures dans des transactions et gérer proprement les fichiers.
5. Ajouter des tests de migration, d'intégrité, de références manquantes et d'échec de persistance.

Les migrations concrètes doivent suivre ce modèle sans créer une table spécifique pour chaque type de fiche. Le schéma détaillé des fiches et des variantes doit être défini avant la première migration qui le met en place.
