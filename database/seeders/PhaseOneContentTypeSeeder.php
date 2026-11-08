<?php

namespace Database\Seeders;

use App\Models\ContentType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PhaseOneContentTypeSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            foreach (['oeuvre' => 'Œuvre', 'production' => 'Production créative', 'document' => 'Document'] as $key => $name) {
                ContentType::unguarded(fn () => ContentType::firstOrCreate(
                    ['scope_type' => 'system', 'key' => $key],
                    ['name' => $name, 'is_system' => true, 'public_id' => (string) Str::uuid()],
                ));
            }
        }, attempts: 3);
    }
}
