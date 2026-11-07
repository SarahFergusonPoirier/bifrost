<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use Database\Seeders\WorldbuildingCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorldbuildingCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_seeds_sixteen_system_content_types_and_templates(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);

        $this->assertSame(16, ContentType::query()->where('is_system', true)->count());
        $this->assertSame(16, ContentTemplate::query()->where('is_system', true)->count());
        $this->assertSame(16, ContentTemplate::query()->whereHas('versions', function ($query) {
            $query->whereNotNull('published_at');
        })->count());
    }

    public function test_catalog_seeder_can_be_run_more_than_once(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);
        $this->seed(WorldbuildingCatalogSeeder::class);

        $this->assertSame(16, ContentType::query()->where('is_system', true)->count());
        $this->assertSame(16, ContentTemplate::query()->where('is_system', true)->count());
    }

    public function test_content_type_endpoint_lists_active_types(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);

        $this->getJson('/api/content-types')
            ->assertOk()
            ->assertJsonCount(16)
            ->assertJsonFragment(['key' => 'personnage', 'name' => 'Personnage']);
    }
}
