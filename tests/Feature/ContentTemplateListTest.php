<?php

namespace Tests\\Feature;

use App\\Models\\ContentTemplate;
use App\\Models\\ContentType;
use App\\Models\\Project;
use App\\Models\\Universe;
use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

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
}
