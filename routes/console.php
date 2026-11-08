<?php

use App\SqliteBackup;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bifrost:backup {destination?}', function (): int {
    try {
        $destination = $this->argument('destination');
        if ($destination === null) {
            $directory = config('bifrost.backup_directory');
            File::ensureDirectoryExists($directory, 0700);
            $destination = $directory.DIRECTORY_SEPARATOR.'bifrost-'.now()->format('Y-m-d_His').'-'.Str::uuid().'.sqlite';
        }

        app(SqliteBackup::class)->backup($destination);
    } catch (RuntimeException $exception) {
        $this->error($exception->getMessage());

        return 1;
    }

    $this->info('Sauvegarde SQLite créée et vérifiée : '.$destination);

    return 0;
})->purpose('Créer une sauvegarde SQLite indépendante');

Artisan::command('bifrost:restore {backup} {destination}', function (): int {
    try {
        app(SqliteBackup::class)->restore($this->argument('backup'), $this->argument('destination'));
    } catch (RuntimeException $exception) {
        $this->error($exception->getMessage());

        return 1;
    }

    $this->info('Sauvegarde restaurée et vérifiée dans le fichier de destination.');

    return 0;
})->purpose('Restaurer une sauvegarde SQLite dans un nouveau fichier');

if (config('bifrost.daily_backup')) {
    Schedule::command('bifrost:backup')->daily()->withoutOverlapping();
}
