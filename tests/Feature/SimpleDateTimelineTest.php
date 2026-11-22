<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SimpleDateTimelineTest extends TestCase
{
    use RefreshDatabase;

    public function test_simple_dates_in_repeatable_groups_support_timeline_defaults_and_updates(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $member = 'c5fbe8cb-4a1f-4782-8e48-8ace8260ad52';
        $entry = 'b5702c88-1a7e-460e-823d-33390fed3dd0';
        $payload = ['value_date' => '2001-01-01', 'date_options' => ['timeline' => true]];
        $template = $this->postJson('/api/content-templates', [
            'name' => 'Parcours', 'content_type_id' => $type->id,
            'fields' => [['label' => 'Parcours', 'section' => 'Parcours', 'type' => 'repeatable',
                'entry_fields' => [['key' => $member, 'label' => 'Date', 'type' => 'date', 'default_value' => $payload]],
                'default_value' => ['value_json' => [['id' => $entry, 'label' => 'Étape', 'values' => [$member => $payload]]]],
            ]],
        ])->assertCreated()->json();
        $fieldId = $this->getJson('/api/content-templates/'.$template['id'])->assertOk()->json('versions.0.fields.0.field_definition_id');
        $id = $this->postJson('/api/contents', [
            'title' => 'Fiche', 'project_id' => $project->id, 'content_type_id' => $type->id, 'template_version_id' => $template['version_id'],
        ])->assertCreated()->json('public_id');
        $timeline = "/api/projects/{$project->id}/timeline";
        $key = $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->json('data.0.key');
        $payload['value_date'] = '2002-02-02';
        $save = fn (array $value) => $this->patchJson('/api/contents/'.$id, ['title' => 'Fiche', 'summary' => null, 'field_values' => [[
            'field_definition_id' => $fieldId, 'value_json' => [['id' => $entry, 'label' => 'Étape', 'values' => [$member => $value]]],
        ]]])->assertOk();
        $save($payload);
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', '2002-02-02');
        $save(['value_state' => 'unknown']);
        $this->getJson($timeline)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_simple_dates_link_update_detach_and_restore_without_duplication(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::create(['key' => 'lieu', 'name' => 'Lieu']);
        $content = $project->contents()->create(['title' => 'Ville', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $field = FieldDefinition::create(['key' => 'fondation', 'label' => 'Fondation', 'value_type' => 'date']);
        $url = '/api/contents/'.$content->public_id;
        $timeline = "/api/projects/{$project->id}/timeline";
        $links = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-links";
        $input = ['title' => 'Ville', 'summary' => null, 'field_values' => [[
            'field_definition_id' => $field->id, 'value_date' => '2001-01-01',
            'date_options' => ['timeline' => true, 'timeline_title' => 'Fondation de la ville', 'calendar' => 'Grégorien'],
        ]]];
        $this->patchJson($url, $input)->assertOk();
        $revision = $this->postJson("$url/snapshots", ['label' => 'Date initiale'])->assertCreated()->json('id');
        $key = $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.date.start', '2001-01-01')->json('data.0.key');
        $this->getJson($links)->assertOk()->assertJsonCount(1, 'timeline')->assertJsonPath('timeline.0.title', 'Fondation de la ville');
        $this->getJson("/api/projects/{$other->id}/timeline")->assertOk()->assertJsonCount(0, 'data');
        $input['field_values'][0]['value_date'] = '2002-02-02';
        $this->patchJson($url, $input)->assertOk();
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', '2002-02-02');
        $input['field_values'][0]['date_options']['timeline'] = false;
        $this->patchJson($url, $input)->assertOk();
        $this->getJson($timeline)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($links)->assertOk()->assertJsonCount(0, 'timeline');
        $this->assertSame('2002-02-02', $content->fieldValues()->sole()->value_date->format('Y-m-d'));
        $this->postJson("$url/revisions/$revision/restore")->assertOk();
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', '2001-01-01');
        $input['field_values'][0] = ['field_definition_id' => $field->id, 'value_state' => 'unknown'];
        $this->patchJson($url, $input)->assertOk();
        $this->assertNull($content->fieldValues()->sole()->date_options);
        $this->getJson($timeline)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_date_options_cannot_be_attached_to_a_text_value_or_an_explicit_unknown_state(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Fiche', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $field = FieldDefinition::create(['key' => 'texte', 'label' => 'Texte', 'value_type' => 'text']);
        foreach ([['value_text' => 'Texte'], ['value_state' => 'unknown']] as $value) {
            $this->patchJson('/api/contents/'.$content->public_id, ['title' => 'Fiche', 'summary' => null, 'field_values' => [[
                'field_definition_id' => $field->id, 'date_options' => ['timeline' => true], ...$value,
            ]]])->assertUnprocessable();
        }
        $this->assertDatabaseCount('content_field_values', 0);
    }
}
