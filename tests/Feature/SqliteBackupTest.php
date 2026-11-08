<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDO;
use Tests\TestCase;

class SqliteBackupTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'bifrost-'.Str::uuid();
        mkdir($this->directory);
    }

    protected function tearDown(): void
    {
        DB::disconnect('sqlite');

        foreach (new \FilesystemIterator($this->directory) as $file) {
            unlink($file->getPathname());
        }

        rmdir($this->directory);

        parent::tearDown();
    }

    public function test_backup_restores_committed_wal_data_to_an_independent_file(): void
    {
        $active = $this->path('active.sqlite');
        $backup = $this->path('backup.sqlite');
        $restored = $this->path('restored.sqlite');
        touch($active);
        config(['database.connections.sqlite.database' => $active]);
        $connection = DB::connection('sqlite');
        $connection->statement('PRAGMA journal_mode=WAL');
        $connection->statement('CREATE TABLE example (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
        $connection->table('example')->insert(['title' => 'Avant la sauvegarde']);
        $this->assertFileExists($active.'-wal');

        config(['bifrost.backup_directory' => $this->directory]);
        $this->artisan('bifrost:backup')->assertSuccessful();
        $backup = glob($this->directory.DIRECTORY_SEPARATOR.'bifrost-*.sqlite')[0];
        $connection->table('example')->update(['title' => 'Après la sauvegarde']);
        $this->artisan('bifrost:restore', ['backup' => $backup, 'destination' => $restored])->assertSuccessful();

        $this->assertSame('Avant la sauvegarde', (new PDO('sqlite:'.$restored))->query('SELECT title FROM example')->fetchColumn());
        $this->assertSame('Après la sauvegarde', $connection->table('example')->value('title'));

        $this->artisan('bifrost:restore', ['backup' => $backup, 'destination' => $active])->assertFailed();
        $this->assertSame('Après la sauvegarde', $connection->table('example')->value('title'));
    }

    public function test_restore_rejects_corrupt_backup_without_publishing_a_file(): void
    {
        $backup = $this->path('backup.sqlite');
        $restored = $this->path('restored.sqlite');
        file_put_contents($backup, 'Données invalides');

        $this->artisan('bifrost:restore', ['backup' => $backup, 'destination' => $restored])->assertFailed();

        $this->assertFileDoesNotExist($restored);
    }

    private function path(string $name): string
    {
        return $this->directory.DIRECTORY_SEPARATOR.$name;
    }
}
