<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use App\Models\TemplateVersion;
use Database\Seeders\CharacterBlocksSeeder;
use Database\Seeders\CharacterIdentitySeeder;
use Database\Seeders\EncyclopedicCatalogSeeder;
use Database\Seeders\WorldbuildingCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorldbuildingCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_block_release_preserves_legacy_personality_values_and_published_versions(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'personnage', 'name' => 'Personnage']);
        $template = ContentTemplate::create(['name' => 'Personnage', 'content_type_id' => $type->id, 'scope_type' => 'global', 'is_system' => true]);
        $legacyField = FieldDefinition::create(['key' => 'legacy-personality', 'label' => 'Personnalité et aptitudes', 'value_type' => 'text']);
        $first = $template->versions()->create(['version_number' => 1]);
        $first->fields()->create(['field_definition_id' => $legacyField->id, 'section_key' => 'character', 'position' => 0]);
        $first->update(['published_at' => now()]);
        $this->seed(CharacterIdentitySeeder::class);
        $identity = $template->versions()->where('change_summary', CharacterIdentitySeeder::RELEASE)->sole();
        $legacy = $template->versions()->create(['version_number' => 3, 'change_summary' => 'Blocs Attributs clés et Personnalité du personnage.']);
        foreach ($identity->fields as $field) {
            $legacy->fields()->save($field->replicate());
        }
        $legacy->update(['published_at' => now()]);
        $id = $this->postJson('/api/contents', ['title' => 'Élia', 'project_id' => $project->id, 'content_type_id' => $type->id, 'template_version_id' => $legacy->id])->assertCreated()->json('public_id');
        $this->patchJson('/api/contents/'.$id, ['title' => 'Élia', 'summary' => null, 'field_values' => [
            ['field_definition_id' => $legacyField->id, 'value_text' => 'Personnalité conservée'],
        ]])->assertOk();
        $oldIds = $legacy->fields()->pluck('id')->all();
        $this->seed(CharacterBlocksSeeder::class);
        $modern = $template->versions()->where('change_summary', CharacterBlocksSeeder::RELEASE)->sole();
        $this->assertSame(4, $modern->version_number);
        $this->assertSame(0, $modern->fields()->where('section_key', 'character')->count());
        $this->assertSame(5, $modern->fields()->where('section_key', 'personality')->count());
        $this->assertSame($oldIds, $legacy->fields()->pluck('id')->all());
        $this->getJson('/api/contents/'.$id)->assertOk()->assertJsonPath('template_assignment.template_version.id', $legacy->id)
            ->assertJsonPath('field_values.0.value_text', 'Personnalité conservée');
        $this->seed(CharacterBlocksSeeder::class);
        $this->assertSame(4, $template->versions()->count());
        $this->postJson("/api/contents/$id/template-versions/{$modern->id}/apply", ['from_version_id' => $legacy->id])->assertOk();
        $this->getJson('/api/contents/'.$id)->assertOk()->assertJsonPath('field_values.0.value_text', 'Personnalité conservée');
    }

    public function test_encyclopedic_publication_does_not_replace_the_minimal_identity_default(): void
    {
        $this->seed(WorldbuildingCatalogSeeder::class);
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::where('key', 'personnage')->sole();
        $template = ContentTemplate::where('name', 'Personnage')->sole();
        $minimal = $template->versions()->reorder('version_number', 'desc')->firstOrFail();
        $this->seed(EncyclopedicCatalogSeeder::class);
        $encyclopedic = $template->versions()->where('change_summary', EncyclopedicCatalogSeeder::RELEASE)->sole();
        $this->assertGreaterThan($minimal->version_number, $encyclopedic->version_number);
        $create = ['title' => 'Élia', 'project_id' => $project->id, 'content_type_id' => $type->id];
        $id = $this->postJson('/api/contents', $create)->assertCreated()->json('public_id');
        $response = $this->getJson('/api/contents/'.$id)->assertOk()->assertJsonPath('template_assignment.template_version.id', $minimal->id);
        $identity = collect($response->json('template_assignment.template_version.fields'))->where('section_key', 'identity');
        $this->assertSame(['Âge', 'Genre', 'Statut vital', 'Rôle narratif'], $identity->pluck('field_definition.label')->all());
        $custom = $this->postJson('/api/contents', $create + ['template_version_id' => $encyclopedic->id])->assertCreated()->json('public_id');
        $this->getJson('/api/contents/'.$custom)->assertOk()->assertJsonPath('template_assignment.template_version.id', $encyclopedic->id);
    }

    public function test_standard_database_seeding_installs_character_defaults_and_can_be_repeated(): void
    {
        $this->seed();
        $this->assertDatabaseCount('content_types', 19);
        $this->assertDatabaseCount('content_templates', 16);
        $this->assertDatabaseCount('users', 1);
        $versionCount = TemplateVersion::count();
        $fieldCount = FieldDefinition::count();
        $this->seed();
        $this->assertDatabaseCount('content_types', 19);
        $this->assertDatabaseCount('content_templates', 16);
        $this->assertDatabaseCount('template_versions', $versionCount);
        $this->assertDatabaseCount('field_definitions', $fieldCount);
        $this->assertDatabaseCount('users', 1);
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::where('key', 'personnage')->sole();
        $id = $this->postJson('/api/contents', ['title' => 'Élia', 'project_id' => $project->id, 'content_type_id' => $type->id])->assertCreated()->json('public_id');
        $response = $this->getJson('/api/contents/'.$id)->assertOk();
        $identity = collect($response->json('template_assignment.template_version.fields'))->where('section_key', 'identity');
        $this->assertSame(['Âge', 'Genre', 'Statut vital', 'Rôle narratif'], $identity->pluck('field_definition.label')->all());
        $age = $identity->first()['field_definition_id'];
        $this->patchJson('/api/contents/'.$id, ['title' => 'Élia', 'summary' => 'Données conservées', 'field_values' => [
            ['field_definition_id' => $age, 'value_number' => 22],
        ]])->assertOk();
        $this->seed();
        $this->getJson('/api/contents/'.$id)->assertOk()->assertJsonPath('summary', 'Données conservées')
            ->assertJsonPath('template_assignment.template_version.id', $response->json('template_assignment.template_version.id'))
            ->assertJsonPath('field_values.0.value_number', '22.000000');
        $this->getJson("/api/projects/{$project->id}/contents/$id/fiche-layout")->assertOk()
            ->assertJsonPath('tabs.0.id', 'overview')->assertJsonPath('tabs.1.id', 'details')
            ->assertJsonPath('tabs.2.id', 'relations')->assertJsonPath('tabs.3.id', 'timeline')->assertJsonCount(4, 'tabs');
    }

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
            ->assertJsonPath('template_assignment.template_version.version_number', 3);
        $allFields = collect($response->json('template_assignment.template_version.fields'));
        $fields = $allFields->where('section_key', 'identity');
        $this->assertSame(['Force', 'Agilité', 'Intelligence', 'Endurance', 'Charisme'],
            $allFields->where('section_key', 'attributes')->pluck('field_definition.label')->all());
        $this->assertSame(['Traits', 'Qualités', 'Défauts', 'Valeurs', 'Peurs'],
            $allFields->where('section_key', 'personality')->pluck('field_definition.label')->all());
        $this->assertCount(0, $allFields->where('section_key', 'character'));
        $this->assertSame(['Âge', 'Genre', 'Statut vital', 'Rôle narratif'], $fields->pluck('field_definition.label')->all());
    }
}
