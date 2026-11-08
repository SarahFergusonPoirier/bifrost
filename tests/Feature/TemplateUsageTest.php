<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateUsageTest extends TestCase
{
    use RefreshDatabase;

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

        $url = "/api/contents/{$content->public_id}/template-versions/{$second->id}";
        $this->getJson("$url/preview")->assertOk()->assertJsonPath('added.0.id', $new->id)
            ->assertJsonPath('removed.0.id', $old->id);
        $this->postJson("$url/apply", ['from_version_id' => $first->id])->assertOk();
        $this->postJson("$url/apply", ['from_version_id' => $first->id])->assertConflict();
        $this->assertSame('À garder', $content->fieldValues()->sole()->value_text);
        $this->assertEquals($second->id, $content->templateAssignment()->sole()->template_version_id);
        $this->assertDatabaseCount('content_template_update_events', 1);
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
}
