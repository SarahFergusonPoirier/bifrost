<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FieldDefaultsTest extends TestCase
{
    use RefreshDatabase;

    public function test_block_defaults_are_typed_validated_and_not_reapplied_to_copies_of_cleared_values(): void
    {
        $content = $this->content();
        $url = "/api/projects/{$content->project_id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($url)->json();
        $block = 'd686c005-41d2-4d5f-93f6-44dc60a12d21';
        $fields = [
            ['label' => 'Texte', 'type' => 'rich_text', 'default_value' => ['value_text' => "\n  **Bonjour**  \n"]],
            ['label' => 'Nombre', 'type' => 'number', 'default_value' => ['value_number' => 0]],
            ['label' => 'Actif', 'type' => 'boolean', 'default_value' => ['value_boolean' => false]],
            ['label' => 'Statut', 'type' => 'choice', 'choices' => ['Actif'], 'default_value' => ['value_text' => 'Refusé']],
            ['label' => 'Inconnu', 'type' => 'text', 'default_value' => ['value_state' => 'unknown']],
        ];
        $fields = array_map(fn (array $field): array => $field + ['section' => 'Libre'], $fields);
        $layout['copies'] = [['id' => $block, 'source' => 'blank-fields', 'title' => 'Libre', 'fields' => $fields]];
        $layout['tabs'][0]['placements'] = [['id' => '4bcba278-e1a1-4ddb-bc1b-90557cb377e1', 'source' => 'fields:'.$block, 'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false]];

        $this->putJson($url, $layout)->assertUnprocessable();
        $this->assertDatabaseCount('content_blocks', 0);
        $this->assertDatabaseCount('field_definitions', 0);
        $layout['copies'][0]['fields'][3]['default_value']['value_text'] = 'Actif';
        $this->putJson($url, $layout)->assertOk();
        $read = $this->getJson('/api/contents/'.$content->public_id)->assertOk()->assertJsonCount(5, 'field_values');
        $read->assertJsonPath('field_values.0.value_text', "\n  **Bonjour**  \n")
            ->assertJsonPath('field_values.1.value_number', '0.000000')
            ->assertJsonPath('field_values.2.value_boolean', false)
            ->assertJsonPath('field_values.4.value_state', 'unknown');
        $textId = $read->json('blocks.0.fields.0.field_definition_id');
        $otherValues = array_slice($read->json('field_values'), 1);
        $otherValues = array_map(fn (array $value): array => array_diff_key($value, array_flip(['id', 'content_id', 'created_at', 'updated_at'])), $otherValues);
        $this->patchJson('/api/contents/'.$content->public_id, ['title' => 'Fiche', 'summary' => null, 'field_values' => $otherValues])->assertOk();
        $copyId = 'd686c005-41d2-4d5f-93f6-44dc60a12d22';
        $next = $this->getJson($url)->json();
        $next['copies'] = [['id' => $copyId, 'source' => 'fields:'.$block]];
        $next['tabs'][0]['placements'][] = [...$next['tabs'][0]['placements'][0], 'id' => '4bcba278-e1a1-4ddb-bc1b-90557cb377e2', 'source' => 'fields:'.$copyId];
        $this->putJson($url, $next)->assertOk();
        $copyField = $content->blocks()->where('public_id', $copyId)->firstOrFail()->field_schema[0]['field_definition_id'];
        $this->assertDatabaseMissing('content_field_values', ['field_definition_id' => $textId]);
        $this->assertDatabaseMissing('content_field_values', ['field_definition_id' => $copyField]);
        $model = $this->postJson("/api/projects/{$content->project_id}/contents/{$content->public_id}/fiche-tab-templates", [
            'name' => 'Avec défauts', 'scope' => 'project', 'tab' => 'overview', 'version' => 2,
            'placement' => '4bcba278-e1a1-4ddb-bc1b-90557cb377e1',
        ])->assertCreated()->json();
        $target = Project::findOrFail($content->project_id)->contents()->create(['title' => 'Cible', 'scope_type' => 'project', 'content_type_id' => $content->content_type_id]);
        $targetUrl = "/api/projects/{$content->project_id}/contents/{$target->public_id}/fiche-layout";
        $targetLayout = $this->getJson($targetUrl)->json();
        $targetLayout['copies'] = [['id' => 'd686c005-41d2-4d5f-93f6-44dc60a12d23', 'source' => 'template-fields', 'template_id' => $model['id'], 'template_revision' => 1, 'slot' => 'blank-fields:0']];
        $targetLayout['tabs'][0]['placements'] = [[...$next['tabs'][0]['placements'][0], 'source' => 'fields:d686c005-41d2-4d5f-93f6-44dc60a12d23']];
        $this->putJson($targetUrl, $targetLayout)->assertOk();
        $this->assertSame("\n  **Bonjour**  \n", $target->fieldValues()->orderBy('id')->firstOrFail()->value_text);
    }

    public function test_new_template_fields_receive_defaults_without_overwriting_existing_values(): void
    {
        $content = $this->content();
        $fields = [['label' => 'Nom', 'section' => 'Identité', 'type' => 'text', 'default_value' => ['value_text' => 'Initial']]];
        $template = $this->postJson('/api/content-templates', ['name' => 'Modèle', 'content_type_id' => $content->content_type_id, 'fields' => $fields])->assertCreated()->json();
        $definitionId = $this->getJson('/api/content-templates/'.$template['id'])->json('versions.0.fields.0.field_definition_id');
        $id = $this->postJson('/api/contents', ['title' => 'Nouvelle fiche', 'project_id' => $content->project_id, 'content_type_id' => $content->content_type_id, 'template_version_id' => $template['version_id']])->assertCreated()->json('public_id');
        $url = '/api/contents/'.$id;
        $this->getJson($url)->assertOk()->assertJsonPath('field_values.0.value_text', 'Initial');
        $clearedId = $this->postJson('/api/contents', ['title' => 'Champ effacé', 'project_id' => $content->project_id, 'content_type_id' => $content->content_type_id, 'template_version_id' => $template['version_id']])->assertCreated()->json('public_id');
        $clearedUrl = '/api/contents/'.$clearedId;
        $this->patchJson($clearedUrl, ['title' => 'Champ effacé', 'summary' => null, 'field_values' => []])->assertOk();
        $this->patchJson($url, ['title' => 'Nouvelle fiche', 'summary' => null, 'field_values' => [['field_definition_id' => $definitionId, 'value_text' => 'Saisi']]])->assertOk();
        $fields[0] += ['id' => $definitionId];
        $fields[0]['default_value']['value_text'] = 'Nouveau défaut';
        $fields[] = ['label' => 'Actif', 'section' => 'Identité', 'type' => 'boolean', 'default_value' => ['value_boolean' => false]];
        $version = $this->postJson('/api/content-templates/'.$template['id'].'/versions', ['from_version_id' => $template['version_id'], 'fields' => $fields])->assertCreated()->json('id');

        $this->postJson("$url/template-versions/$version/apply", ['from_version_id' => $template['version_id']])->assertOk();

        $this->getJson($url)->assertOk()->assertJsonCount(2, 'field_values')
            ->assertJsonPath('field_values.0.value_text', 'Saisi')->assertJsonPath('field_values.1.value_boolean', false);
        $this->postJson("$clearedUrl/template-versions/$version/apply", ['from_version_id' => $template['version_id']])->assertOk();
        $this->getJson($clearedUrl)->assertOk()->assertJsonCount(1, 'field_values')->assertJsonPath('field_values.0.value_boolean', false);
        $newId = $this->postJson('/api/contents', ['title' => 'Autre fiche', 'project_id' => $content->project_id, 'content_type_id' => $content->content_type_id, 'template_version_id' => $version])->assertCreated()->json('public_id');
        $this->getJson('/api/contents/'.$newId)->assertOk()->assertJsonPath('field_values.0.value_text', 'Nouveau défaut');
    }

    public function test_default_references_cannot_import_values_from_another_project(): void
    {
        $content = $this->content();
        $foreign = $this->content();
        $url = "/api/projects/{$content->project_id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($url)->json();
        $layout['copies'] = [['id' => '63cc9dce-06c7-4c08-a5b9-530dfcc578e7', 'source' => 'blank-fields', 'title' => 'Lien', 'fields' => [[
            'label' => 'Allié', 'section' => 'Lien', 'type' => 'reference', 'default_value' => ['reference_content_id' => $foreign->id],
        ]]]];
        $layout['tabs'][0]['placements'] = [['id' => 'a54e1d0a-c789-4bbc-977a-eddb79902c9c', 'source' => 'fields:63cc9dce-06c7-4c08-a5b9-530dfcc578e7', 'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false]];

        $this->putJson($url, $layout)->assertUnprocessable()->assertJsonValidationErrors('reference_content_id');

        $this->assertDatabaseCount('field_definitions', 0);
        $this->assertDatabaseCount('content_blocks', 0);
        $this->assertDatabaseCount('fiche_layout_revisions', 0);
    }

    public function test_incompatible_defaults_are_rejected_before_publishing_a_template(): void
    {
        $content = $this->content();
        $input = ['name' => 'Modèle', 'content_type_id' => $content->content_type_id, 'fields' => [[
            'label' => 'Statut', 'section' => 'Identité', 'type' => 'choice', 'choices' => ['Actif'], 'default_value' => ['value_number' => 3],
        ]]];
        $this->postJson('/api/content-templates', $input)->assertUnprocessable()->assertJsonValidationErrors('default_value');
        $this->assertDatabaseCount('content_templates', 0);
        $input['fields'][0]['default_value'] = ['value_text' => 'Actif'];
        $template = $this->postJson('/api/content-templates', $input)->assertCreated()->json();
        $field = $this->getJson('/api/content-templates/'.$template['id'])->json('versions.0.fields.0');
        $next = ['from_version_id' => $template['version_id'], 'fields' => [[
            'id' => $field['field_definition_id'], 'label' => 'Statut', 'section' => 'Identité', 'type' => 'choice', 'choices' => ['Retraité'],
        ]]];

        $this->postJson('/api/content-templates/'.$template['id'].'/versions', $next)->assertUnprocessable()->assertJsonValidationErrors('default_value');

        $this->assertDatabaseCount('template_versions', 1);
        $next['fields'][0]['default_value'] = null;
        $this->postJson('/api/content-templates/'.$template['id'].'/versions', $next)->assertCreated();
        $this->getJson('/api/content-templates/'.$template['id'])->assertOk()
            ->assertJsonPath('versions.0.fields.0.default_value.value_text', 'Actif')->assertJsonPath('versions.1.fields.0.default_value', null);
    }

    private function content(): Content
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::firstOrCreate(['key' => 'fiche'], ['name' => 'Fiche']);

        return $project->contents()->create(['title' => 'Fiche', 'scope_type' => 'project', 'content_type_id' => $type->id]);
    }
}
