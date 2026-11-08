<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use Database\Seeders\EncyclopedicCatalogSeeder;
use Database\Seeders\WorldbuildingCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EncyclopedicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_publishing_the_catalog_is_idempotent_and_preserves_the_legacy_versions(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);
        $character = ContentTemplate::where('name', 'Personnage')->sole();
        $original = $character->versions()->where('version_number', 1)->sole();
        $legacyVersionCount = $character->versions()->count();
        $fields = $original->fields()->pluck('id')->all();

        $this->seed(EncyclopedicCatalogSeeder::class);
        $this->seed(EncyclopedicCatalogSeeder::class);

        $sections = ['Personnage' => 11, 'Lieu' => 14, 'Organisation' => 13, 'Événement' => 12, 'Objet' => 12, 'Faune' => 14, 'Flore' => 14];
        foreach ($sections as $name => $count) {
            $template = ContentTemplate::where('name', $name)->where('is_system', true)->sole();
            $version = $template->versions()->where('change_summary', EncyclopedicCatalogSeeder::RELEASE)->sole();
            $this->assertNotNull($version->published_at);
            $this->assertCount($count, $version->fields->pluck('section_key')->unique());
        }

        $this->assertSame($fields, $original->fields()->pluck('id')->all());
        $this->assertCount($legacyVersionCount + 1, $character->versions);
    }
}
