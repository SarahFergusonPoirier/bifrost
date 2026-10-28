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
