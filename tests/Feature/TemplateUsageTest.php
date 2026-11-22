<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateUsageTest extends TestCase
{
    use RefreshDatabase;

    public function test_capability_descriptions_preserve_long_rich_text(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'abilities', 'name' => 'Capacités']);
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Capacités', 'content_type_id' => $type->id,
            'fields' => [['label' => 'Techniques', 'section' => 'Capacités', 'type' => 'capabilities']],
        ])->assertCreated()->json();
        $fieldId = $this->getJson('/api/content-templates/'.$template['id'])->assertOk()->json('versions.0.fields.0.field_definition_id');
        $id = $this->postJson('/api/contents', [
            'title' => 'Fiche', 'project_id' => $project->id, 'content_type_id' => $type->id,
            'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $description = str_repeat("## Technique\nUne **description** détaillée.\n- Une condition\n", 200);
        $input = ['title' => 'Fiche', 'summary' => null, 'field_values' => [
            ['field_definition_id' => $fieldId, 'value_json' => [['label' => 'Technique', 'description' => $description]]],
        ]];
        $this->patchJson("/api/contents/$id", $input)->assertOk();
        $this->getJson("/api/contents/$id")->assertOk()->assertJsonPath('field_values.0.value_json.0.description', $description);
        $input['field_values'][0]['value_json'][0]['description'] = ['Texte invalide'];
        $this->patchJson("/api/contents/$id", $input)->assertUnprocessable();
        $this->getJson("/api/contents/$id")->assertOk()->assertJsonPath('field_values.0.value_json.0.description', $description);
    }

    public function test_removed_choices_can_be_retained_but_not_introduced_again_after_removal(): void
    {
        $type = ContentType::create(['key' => 'choice-history', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Choix', 'content_type_id' => $type->id,
            'fields' => [
                ['label' => 'État', 'section' => 'État', 'type' => 'choice', 'choices' => ['Actif', 'Ancien']],
                ['label' => 'Couleurs', 'section' => 'État', 'type' => 'multiple_choice', 'choices' => ['Rouge', 'Bleu']],
            ],
        ])->assertCreated()->json();
        $fields = $this->getJson("/api/content-templates/{$template['id']}")->assertOk()->json('versions.0.fields');
        $id = $this->postJson('/api/contents', [
            'title' => 'Fiche', 'project_id' => $project->id, 'content_type_id' => $type->id,
            'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $input = ['title' => 'Fiche', 'summary' => null, 'field_values' => [
            ['field_definition_id' => $fields[0]['field_definition_id'], 'value_text' => 'Ancien'],
            ['field_definition_id' => $fields[1]['field_definition_id'], 'value_json' => ['Rouge', 'Bleu']],
        ]];
        $this->patchJson("/api/contents/$id", $input)->assertOk();
        $version = $this->postJson("/api/content-templates/{$template['id']}/versions", [
            'from_version_id' => $template['version_id'],
            'fields' => [
                ['id' => $fields[0]['field_definition_id'], 'label' => 'État', 'section' => 'État', 'type' => 'choice', 'choices' => ['Actif']],
                ['id' => $fields[1]['field_definition_id'], 'label' => 'Couleurs', 'section' => 'État', 'type' => 'multiple_choice', 'choices' => ['Bleu', 'Vert']],
            ],
        ])->assertCreated()->json('id');
        $this->postJson("/api/contents/$id/template-versions/$version/apply", ['from_version_id' => $template['version_id']])->assertOk();
        $input['field_values'][1]['value_json'] = ['Rouge', 'Vert'];
        $this->patchJson("/api/contents/$id", $input)->assertOk();
        $this->assertDatabaseHas('content_field_values', ['content_id' => Content::where('public_id', $id)->value('id'), 'value_text' => 'Ancien']);
        $input['field_values'][0]['value_text'] = 'Inventé';
        $this->patchJson("/api/contents/$id", $input)->assertUnprocessable();
        $input['field_values'][0]['value_text'] = 'Actif';
        $input['field_values'][1]['value_json'] = ['Vert'];
        $this->patchJson("/api/contents/$id", $input)->assertOk();
        $input['field_values'][0]['value_text'] = 'Ancien';
        $this->patchJson("/api/contents/$id", $input)->assertUnprocessable();
        $input['field_values'][0]['value_text'] = 'Actif';
        $input['field_values'][1]['value_json'] = ['Rouge'];
        $this->patchJson("/api/contents/$id", $input)->assertUnprocessable();
    }

    public function test_custom_project_type_is_usable_only_in_its_project(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = $this->postJson('/api/content-types', ['name' => 'Créature locale', 'project_id' => $project->id])
            ->assertCreated()->assertJsonPath('scope_type', 'project')->json('id');

        $input = ['title' => 'Créature', 'content_type_id' => $type];
        $this->postJson('/api/contents', $input + ['project_id' => $other->id])->assertUnprocessable();
        $this->postJson('/api/contents', $input + ['project_id' => $project->id])->assertCreated();
        $this->postJson('/api/content-templates', ['name' => 'Modèle', 'content_type_id' => $type, 'fields' => []])
            ->assertUnprocessable();
        $this->postJson('/api/content-templates', [
            'name' => 'Modèle', 'content_type_id' => $type, 'project_id' => $project->id, 'fields' => [],
        ])->assertCreated();
    }

    public function test_choice_options_are_versioned_and_validated_for_both_choice_modes(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Choix', 'content_type_id' => $type->id,
            'fields' => [
                ['label' => 'État', 'section' => 'État', 'type' => 'choice', 'choices' => ['Actif', 'Inactif']],
                ['label' => 'Couleurs', 'section' => 'État', 'type' => 'multiple_choice', 'choices' => ['Rouge', 'Bleu']],
            ],
        ])->assertCreated()->json();
        $fields = $this->getJson("/api/content-templates/{$template['id']}")->assertOk()->json('versions.0.fields');
        $id = $this->postJson('/api/contents', [
            'title' => 'Fiche', 'project_id' => $project->id, 'content_type_id' => $type->id,
            'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $input = [
            'title' => 'Fiche', 'summary' => null,
            'field_values' => [
                ['field_definition_id' => $fields[0]['field_definition_id'], 'value_text' => 'Actif'],
                ['field_definition_id' => $fields[1]['field_definition_id'], 'value_json' => ['Rouge', 'Bleu']],
            ],
        ];

        $this->patchJson("/api/contents/$id", $input)->assertOk();
        $input['field_values'][1]['value_json'] = ['Vert'];
        $this->patchJson("/api/contents/$id", $input)->assertUnprocessable();
        $this->getJson("/api/contents/$id")->assertOk()->assertJsonPath('field_values.1.value_json', ['Rouge', 'Bleu']);
    }

    public function test_image_fields_can_be_published_in_a_reusable_template(): void
    {
        $type = ContentType::create(['key' => 'portrait', 'name' => 'Portrait']);
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Galerie', 'content_type_id' => $type->id,
            'fields' => [['label' => 'Portrait', 'section' => 'Identité', 'type' => 'image']],
        ])->assertCreated()->json();

        $this->getJson('/api/content-templates/'.$template['id'])->assertOk()
            ->assertJsonPath('versions.0.fields.0.field_definition.value_type', 'json')
            ->assertJsonPath('versions.0.fields.0.field_definition.options_data.format', 'image');
    }

    public function test_rich_text_fields_preserve_long_formatted_values_in_any_section(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'journal', 'name' => 'Journal']);
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Journal de terrain', 'content_type_id' => $type->id,
            'fields' => [['label' => 'Observations', 'section' => 'Terrain', 'type' => 'rich_text']],
        ])->assertCreated()->json();
        $fieldId = $this->getJson('/api/content-templates/'.$template['id'])->assertOk()
            ->assertJsonPath('versions.0.fields.0.field_definition.value_type', 'text')
            ->assertJsonPath('versions.0.fields.0.field_definition.options_data.format', 'rich_text')
            ->json('versions.0.fields.0.field_definition_id');
        $contentId = $this->postJson('/api/contents', [
            'title' => 'Observations', 'project_id' => $project->id, 'content_type_id' => $type->id,
            'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $text = str_repeat("## Une rencontre\nUn **souvenir**.\n- Un départ\n", 300);

        $this->patchJson('/api/contents/'.$contentId, [
            'title' => 'Observations', 'summary' => null,
            'field_values' => [['field_definition_id' => $fieldId, 'value_text' => $text]],
        ])->assertOk();

        $this->getJson('/api/contents/'.$contentId)->assertOk()->assertJsonPath('field_values.0.value_text', $text);
    }

    public function test_custom_templates_can_be_duplicated_and_versioned_without_mutating_the_source(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $input = ['name' => 'Modèle', 'content_type_id' => $type->id, 'fields' => [
            ['label' => 'Nom', 'section' => 'Identité', 'type' => 'text'],
        ]];
        $source = $this->postJson('/api/content-templates', $input)->assertCreated()->json();
        $original = $this->getJson("/api/content-templates/{$source['id']}")->assertOk()->json('versions.0.fields.0');
        $fields = [['id' => $original['field_definition_id'], 'label' => 'Autre nom', 'section' => 'Identité', 'type' => 'text']];
        $copy = $this->postJson('/api/content-templates', array_replace($input, [
            'name' => 'Copie', 'project_id' => $project->id, 'base_version_id' => $source['version_id'], 'fields' => $fields,
        ]))->assertCreated()->json();
        $this->getJson("/api/content-templates/{$copy['id']}")->assertOk()
            ->assertJsonPath('base_template_id', $source['id'])->assertJsonPath('versions.0.fields.0.label_override', 'Autre nom');

        $url = "/api/content-templates/{$source['id']}/versions";
        $update = ['from_version_id' => $source['version_id'], 'fields' => $fields];
        $this->postJson($url, $update)->assertCreated()->assertJsonPath('version_number', 2);
        $this->postJson($url, $update)->assertConflict();
        $this->getJson("/api/content-templates/{$source['id']}")->assertOk()
            ->assertJsonPath('versions.0.fields.0.label_override', 'Nom')
            ->assertJsonPath('versions.1.fields.0.field_definition_id', $original['field_definition_id']);
    }

    public function test_scale_reduction_requires_an_explicit_strategy_and_preserves_existing_values(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $field = ['label' => 'Force', 'section' => 'Attributs', 'type' => 'scale', 'levels' => 5];
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Échelle', 'content_type_id' => $type->id, 'fields' => [$field],
        ])->assertCreated()->json();
        $field['id'] = $this->getJson("/api/content-templates/{$template['id']}")->json('versions.0.fields.0.field_definition_id');
        $id = $this->postJson('/api/contents', [
            'title' => 'Fiche', 'content_type_id' => $type->id, 'project_id' => $project->id, 'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $url = "/api/contents/$id";
        $save = fn (int $level) => $this->patchJson($url, [
            'title' => 'Fiche', 'summary' => null, 'field_values' => [
                ['field_definition_id' => $field['id'], 'value_json' => ['level' => $level]],
            ],
        ]);
        $save(5)->assertOk();

        $field['levels'] = 3;
        $versions = "/api/content-templates/{$template['id']}/versions";
        $from = ['from_version_id' => $template['version_id']];
        $this->postJson($versions, $from + ['fields' => [$field]])->assertUnprocessable();
        $version = $this->postJson($versions, $from + ['fields' => [$field + ['scale_strategy' => 'preserve']]])
            ->assertCreated()->json('id');
        $this->getJson("$url/template-versions/$version/preview")->assertOk()
            ->assertJsonPath('changed.0.scale_change', ['from' => 5, 'to' => 3, 'preserved_level' => 5]);
        $this->postJson("$url/template-versions/$version/apply", $from)->assertOk();
        $save(5)->assertOk();
        $save(4)->assertUnprocessable();
        $save(3)->assertOk();
    }

    public function test_version_adoption_preserves_removed_values_and_rejects_stale_previews(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $template = ContentTemplate::create([
            'name' => 'Modèle', 'scope_type' => 'global', 'content_type_id' => $type->id,
        ]);
        $old = FieldDefinition::create(['key' => 'old', 'label' => 'Ancien', 'value_type' => 'text']);
        $new = FieldDefinition::create(['key' => 'new', 'label' => 'Nouveau', 'value_type' => 'text']);
        $first = $template->versions()->create(['version_number' => 1]);
        $first->fields()->create(['field_definition_id' => $old->id, 'position' => 0]);
        $first->update(['published_at' => now()]);
        $second = $template->versions()->create(['version_number' => 2]);
        $second->fields()->create(['field_definition_id' => $new->id, 'position' => 0]);
        $second->update(['published_at' => now()]);
        $content = $project->contents()->create(['title' => 'Fiche', 'content_type_id' => $type->id, 'scope_type' => 'project']);
        $content->templateAssignment()->create(['template_id' => $template->id, 'template_version_id' => $first->id]);
        $content->fieldValues()->create(['field_definition_id' => $old->id, 'value_text' => 'À garder']);

        $ficheUrl = "/api/contents/{$content->public_id}";
        $oldToken = trim($this->getJson($ficheUrl)->assertOk()->headers->get('ETag'), '"');
        $url = "$ficheUrl/template-versions/{$second->id}";
        $this->getJson("$url/preview")->assertOk()->assertJsonPath('added.0.id', $new->id)
            ->assertJsonPath('removed.0.id', $old->id);
        $this->postJson("$url/apply", ['from_version_id' => $first->id])->assertOk();
        $this->postJson("$url/apply", ['from_version_id' => $first->id])->assertConflict();
        $this->assertSame('À garder', $content->fieldValues()->sole()->value_text);
        $this->assertEquals($second->id, $content->templateAssignment()->sole()->template_version_id);
        $this->assertDatabaseCount('content_template_update_events', 1);
        $this->getJson("/api/contents/{$content->public_id}")->assertOk()
            ->assertJsonPath('archived_field_definitions.0.id', $old->id)
            ->assertJsonPath('archived_field_definitions.0.label', 'Ancien');

        $edit = ['title' => 'Fiche éditée', 'summary' => null];
        $this->patchJson($ficheUrl, $edit + ['version' => $oldToken, 'field_values' => []])->assertConflict();
        $this->patchJson("/api/contents/{$content->public_id}", $edit + [
            'field_values' => [['field_definition_id' => $new->id, 'value_text' => 'Valeur actuelle']],
        ])->assertOk();
        $this->patchJson("/api/contents/{$content->public_id}", $edit + ['field_values' => []])->assertOk();
        $this->assertSame('À garder', $content->fieldValues()->sole()->value_text);
    }

    public function test_only_published_versions_can_be_used_when_creating_a_content(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $template = ContentTemplate::create([
            'name' => 'Modèle', 'scope_type' => 'global', 'content_type_id' => $type->id,
        ])->refresh();
        $published = $template->versions()->create(['version_number' => 1, 'published_at' => now()]);
        $draft = $template->versions()->create(['version_number' => 2]);

        $this->getJson("/api/content-templates/{$template->id}")
            ->assertOk()->assertJsonCount(1, 'versions')->assertJsonPath('versions.0.id', $published->id);

        $input = ['title' => 'Fiche', 'project_id' => $project->id, 'content_type_id' => $type->id];
        $this->postJson('/api/contents', $input + ['template_version_id' => $draft->id])
            ->assertUnprocessable();
        $this->assertDatabaseCount('contents', 0);

        $id = $this->postJson('/api/contents', $input + ['template_version_id' => $published->id])
            ->assertCreated()->json('public_id');
        $this->getJson("/api/contents/$id")->assertOk()
            ->assertJsonPath('template_assignment.template_version.id', $published->id);
    }

    public function test_number_calculation_is_versioned_and_rejects_text_fields(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $field = ['label' => 'Âge', 'section' => 'Identité', 'type' => 'number', 'calculation' => 'age'];
        $payload = ['name' => 'Personnage', 'content_type_id' => $type->id, 'fields' => [$field]];
        $template = $this->postJson('/api/content-templates', $payload)->assertCreated()->json();
        $url = "/api/content-templates/{$template['id']}";
        $definitionId = $this->getJson($url)->assertOk()
            ->assertJsonPath('versions.0.fields.0.display_options.calculation', 'age')
            ->json('versions.0.fields.0.field_definition_id');

        $this->postJson("$url/versions", [
            'from_version_id' => $template['version_id'],
            'fields' => [array_replace($field, ['id' => $definitionId, 'calculation' => 'none'])],
        ])->assertCreated();
        $this->getJson($url)->assertOk()
            ->assertJsonPath('versions.0.fields.0.display_options.calculation', 'age')
            ->assertJsonPath('versions.1.fields.0.display_options.calculation', 'none');

        $payload['fields'][0]['type'] = 'text';
        $this->postJson('/api/content-templates', $payload)->assertUnprocessable()->assertJsonValidationErrors('fields');
    }
}
