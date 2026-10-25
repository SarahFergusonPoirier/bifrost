# Bifrost

Bifrost est un espace de création local pour organiser des projets d’écriture et de
construction d’univers. L’application utilise Laravel pour l’API et la persistance,
et Vue 3 pour l’interface.

## Prérequis

- PHP 8.3 ou plus récent
- Composer
- Node.js et npm
- Une base de données configurée dans le fichier `.env` (SQLite convient à un usage local)

## Installation locale

1. Installer les dépendances PHP et JavaScript :

   ```bash
   composer install
   npm install
   ```

2. Créer la configuration locale à partir du modèle :

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

   Sous Windows, copier manuellement `.env.example` vers `.env` si la commande `cp`
   n’est pas disponible.

3. Configurer la base de données dans `.env`. Pour SQLite, créer le fichier de base
   de données indiqué par `DB_DATABASE` si nécessaire, puis lancer les migrations :

   ```bash
   php artisan migrate
   ```

4. Démarrer l’application en développement dans deux terminaux :

   ```bash
   php artisan serve
   npm run dev
   ```

   Ouvrir l’adresse locale affichée par Artisan, généralement `http://127.0.0.1:8000`.

## Tests et compilation

```bash
npx vitest run
php artisan test
npm run build
```

## Structure

- `app/` et `routes/` : API Laravel.
- `resources/js/views/` : pages Vue, avec templates `.vue` et logique dans les fichiers
  adjacents `.js`.
- `resources/js/services/` : appels à l’API.
- `resources/css/` : styles de l’application.
- `tests/Feature/` : tests Laravel.
- `tests/js/` : tests Vitest.

Les conventions détaillées sont dans [docs/architecture.md](docs/architecture.md).
