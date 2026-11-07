<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\TemplateVersion;
use App\Models\TemplateVersionField;
use App\Models\Project;
use App\Models\Universe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContentTemplateListTest extends TestCase
{
    use RefreshDatabase;

    private function createTemplate(array $attributes = []): ContentTemplate
    {
        $type = ContentType::create([
            'key' => 'note-' . uniqid(),
            'name' => 'Note',
        ]);

        return ContentTemplate::create(array_merge([
            'name' => 'Modèle de note',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
            'is_active' => true,
        ], $attributes));
    }

    public function test_active_templates_are_listed_by_default(): void
    {
        $active = $this->createTemplate(['name' => 'Modèle actif']);
        $this->createTemplate([
            'name' => 'Modèle désactivé',
            'is_active' => false,
        ]);

        $this->getJson('/api/content-templates')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'id' => $active->id,
                'name' => 'Modèle actif',
            ])
            ->assertJsonMissing(['name' => 'Modèle désactivé']);
    }

    public function test_templates_can_be_filtered_by_scope(): void
    {
        $project = Project::create(['name' => 'Projet test']);
        $this->createTemplate(['name' => 'Modèle global']);

        $this->createTemplate([
            'name' => 'Modèle de projet',
            'scope_type' => 'project',
            'project_id' => $project->id,
        ]);

        $this->getJson('/api/content-templates?scope=project')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Modèle de projet'])
            ->assertJsonMissing(['name' => 'Modèle global']);
    }

    public function test_templates_can_be_filtered_by_status(): void
    {
        $this->createTemplate(['name' => 'Modèle actif']);
        $inactive = $this->createTemplate([
            'name' => 'Modèle désactivé',
            'is_active' => false,
        ]);

        $this->getJson('/api/content-templates?status=inactive')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'id' => $inactive->id,
                'name' => 'Modèle désactivé',
            ]);
    }

    public function test_all_statuses_can_be_displayed_together(): void
    {
        $this->createTemplate(['name' => 'Modèle actif']);
        $this->createTemplate([
            'name' => 'Modèle désactivé',
            'is_active' => false,
        ]);

        $this->getJson('/api/content-templates?status=all')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_templates_can_be_searched_by_name(): void
    {
        $this->createTemplate(['name' => 'Fiche de personnage']);
        $this->createTemplate(['name' => 'Fiche de lieu']);

        $this->getJson('/api/content-templates?search=personnage')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['name' => 'Fiche de personnage']);
    }

    public function test_template_list_includes_its_content_type_and_scope_context(): void
    {
        $universe = Universe::create(['name' => 'Les Brumes']);
        $template = $this->createTemplate([
            'name' => 'Fiche de créature',
            'scope_type' => 'universe',
            'universe_id' => $universe->id,
        ]);

        $this->getJson('/api/content-templates')
            ->assertOk()
            ->assertJsonFragment(['id' => $template->id])
            ->assertJsonPath('0.content_type.name', 'Note')
            ->assertJsonPath('0.universe.name', 'Les Brumes');
    }

    public function test_invalid_template_filters_are_rejected(): void
    {
        $this->getJson('/api/content-templates?scope=unknown')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scope');
    }

    public function test_custom_template_creation_starts_with_a_draft_version(): void
    {
        $type = ContentType::create([
            'key' => 'custom-personnage',
            'name' => 'Personnage',
        ]);

        $this->postJson('/api/content-templates', [
            'name' => 'Fiche de héros',
            'description' => 'Une fiche personnalisée.',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'Fiche de héros')
            ->assertJsonPath('is_system', false)
            ->assertJsonPath('versions.0.version_number', 1)
            ->assertJsonPath('versions.0.published_at', null);

        $this->assertDatabaseHas('content_templates', [
            'name' => 'Fiche de héros',
            'scope_type' => 'global',
            'is_system' => false,
        ]);
    }

    public function test_custom_template_can_be_created_for_a_project(): void
    {
        $project = Project::create(['name' => 'Projet ciblé']);
        $type = ContentType::create([
            'key' => 'project-character',
            'name' => 'Personnage de projet',
        ]);

        $this->postJson('/api/content-templates', [
            'name' => 'Fiche locale',
            'content_type_id' => $type->id,
            'scope_type' => 'project',
            'project_id' => $project->id,
        ])
            ->assertCreated()
            ->assertJsonPath('scope_type', 'project')
            ->assertJsonPath('project.id', $project->id);
    }

    public function test_custom_template_metadata_can_be_updated(): void
    {
        $template = $this->createTemplate(['name' => 'Ancien nom']);

        $this->putJson('/api/content-templates/' . $template->id, [
            'name' => 'Nouveau nom',
            'description' => 'Description mise à jour.',
            'content_type_id' => $template->content_type_id,
            'scope_type' => 'global',
        ])
            ->assertOk()
            ->assertJsonPath('name', 'Nouveau nom')
            ->assertJsonPath('description', 'Description mise à jour.');
    }

    public function test_system_templates_cannot_be_edited(): void
    {
        $type = ContentType::create([
            'key' => 'system-example',
            'name' => 'Type système',
            'scope_type' => 'system',
            'is_system' => true,
        ]);

        $template = ContentTemplate::create([
            'name' => 'Modèle système',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
            'is_system' => true,
        ]);

        $this->putJson('/api/content-templates/' . $template->id, [
            'name' => 'Nom modifié',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
        ])->assertForbidden();

        $this->assertDatabaseHas('content_templates', [
            'id' => $template->id,
            'name' => 'Modèle système',
        ]);
    }


    public function test_system_template_can_be_cloned_as_a_custom_draft(): void
    {
        $type = ContentType::create([
            'key' => 'system-character',
            'name' => 'Personnage',
            'scope_type' => 'system',
            'is_system' => true,
        ]);

        $source = ContentTemplate::create([
            'name' => 'Personnage système',
            'description' => 'Modèle original.',
            'content_type_id' => $type->id,
            'scope_type' => 'global',
            'is_system' => true,
        ]);

        $sourceVersion = TemplateVersion::create([
            'template_id' => $source->id,
            'version_number' => 1,
            'published_at' => now(),
        ]);

        $definition = FieldDefinition::create([
            'key' => 'character-name-test',
            'label' => 'Nom',
            'value_type' => 'text',
            'scope_type' => 'global',
        ]);

        TemplateVersionField::create([
            'template_version_id' => $sourceVersion->id,
            'field_definition_id' => $definition->id,
            'section_key' => 'identity',
            'position' => 0,
            'is_required' => false,
        ]);

        $response = $this->postJson('/api/content-templates/' . $source->id . '/clone')
            ->assertCreated()
            ->assertJsonPath('name', 'Personnage système (copie)')
            ->assertJsonPath('is_system', false)
            ->assertJsonPath('base_template_id', $source->id)
            ->assertJsonPath('versions.0.published_at', null);

        $copyId = $response->json('id');
        $this->assertDatabaseHas('template_version_fields', [
            'template_version_id' => TemplateVersion::where('template_id', $copyId)->value('id'),
            'field_definition_id' => $definition->id,
            'section_key' => 'identity',
        ]);
    }


}
