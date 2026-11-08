<?php

return [
    'backup_directory' => env('BIFROST_BACKUP_DIRECTORY', storage_path('app/private/backups')),
    'daily_backup' => env('BIFROST_DAILY_BACKUP', false),
];
