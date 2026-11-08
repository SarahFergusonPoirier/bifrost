<?php

namespace App;

use Illuminate\Support\Facades\DB;
use PDO;
use Pdo\Sqlite;
use RuntimeException;

class SqliteBackup
{
    public function backup(string $destination): void
    {
        $connection = DB::connection();

        if ($connection->getDriverName() !== 'sqlite' || ! is_file($connection->getDatabaseName())) {
            throw new RuntimeException('La sauvegarde exige une base SQLite sur disque.');
        }

        $this->export($connection->getPdo(), $destination);
    }

    public function restore(string $backup, string $destination): void
    {
        if (! is_file($backup) || filesize($backup) === 0) {
            throw new RuntimeException('Le fichier de sauvegarde est introuvable ou vide.');
        }

        $source = $this->openReadOnly($backup);
        $this->verify($source);
        $this->export($source, $destination);
    }

    private function export(PDO $source, string $destination): void
    {
        $directory = realpath(dirname($destination));
        if ($directory === false || ! is_dir($directory)) {
            throw new RuntimeException('Le dossier de destination doit exister.');
        }

        $target = $directory.DIRECTORY_SEPARATOR.basename($destination);
        if (file_exists($target) || is_link($target)) {
            throw new RuntimeException('La destination existe déjà.');
        }

        $temporary = tempnam($directory, '.bifrost-');
        if ($temporary === false) {
            throw new RuntimeException('Impossible de créer le fichier temporaire.');
        }

        try {
            $source->prepare('VACUUM INTO ?')->execute([$temporary]);
            $this->verify($this->openReadOnly($temporary));

            // Publish atomically without replacing a file created concurrently.
            if (! @link($temporary, $target)) {
                throw new RuntimeException('Impossible de publier la copie. Vérifie que la destination est libre et accepte les liens physiques.');
            }
        } finally {
            unlink($temporary);
        }
    }

    private function openReadOnly(string $path): PDO
    {
        return new PDO('sqlite:'.$path, options: [Sqlite::ATTR_OPEN_FLAGS => Sqlite::OPEN_READONLY]);
    }

    private function verify(PDO $database): void
    {
        $integrity = $database->query('PRAGMA integrity_check')->fetchAll(PDO::FETCH_COLUMN);
        $foreignKeyViolation = $database->query('PRAGMA foreign_key_check')->fetch();

        if ($integrity !== ['ok'] || $foreignKeyViolation !== false) {
            throw new RuntimeException('La vérification de l’intégrité SQLite a échoué.');
        }
    }
}
