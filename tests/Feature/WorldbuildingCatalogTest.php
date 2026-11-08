<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\Project;
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

    public function test_new_character_uses_the_published_identity_fields(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::where('key', 'personnage')->sole();
        $id = $this->postJson('/api/contents', [
            'title' => 'Élia', 'project_id' => $project->id, 'content_type_id' => $type->id,
        ])->assertCreated()->json('public_id');
        $response = $this->getJson('/api/contents/'.$id)->assertOk()
            ->assertJsonPath('template_assignment.template_version.version_number', 2);
        $fields = collect($response->json('template_assignment.template_version.fields'))->where('section_key', 'identity');
        $this->assertSame(['Âge', 'Genre', 'Statut vital', 'Rôle narratif'], $fields->pluck('field_definition.label')->all());
    }
}
