<?php

namespace Tests\Feature;

use App\FieldSchema;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RepeatableFieldsTest extends TestCase
{
    use RefreshDatabase;

    public function test_retired_members_do_not_reduce_the_capacity_for_current_group_values(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $members = [];
        $values = [];
        for ($index = 0; $index < 20; $index++) {
            $key = (string) Str::uuid();
            $members[] = ['key' => $key, 'label' => 'Ancien '.$index, 'type' => 'text'];
            $values[$key] = ['value_text' => 'Conservé'];
        }
        $field = FieldDefinition::create(FieldSchema::definitionAttributes(['label' => 'Groupe', 'section' => 'Groupe', 'type' => 'repeatable', 'entry_fields' => $members], 'project', $project->id));
        $block = $content->blocks()->create(['block_type' => 'fields', 'title' => 'Groupe', 'field_schema' => [['field_definition_id' => $field->id]]]);
        $entries = [['id' => (string) Str::uuid(), 'label' => 'Entrée', 'values' => $values]];
        $content->fieldValues()->create(['field_definition_id' => $field->id, 'value_json' => $entries]);
        $url = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($url)->json();
        $newKey = (string) Str::uuid();
        $layout['block_updates'] = [['id' => $block->public_id, 'title' => 'Groupe', 'fields' => [[
            'id' => $field->id, 'label' => 'Groupe', 'section' => 'Groupe', 'type' => 'repeatable',
            'entry_fields' => [['key' => $newKey, 'label' => 'Actuel', 'type' => 'text']],
        ]]]];
        $this->putJson($url, $layout)->assertOk();
        $entries[0]['values'][$newKey] = ['value_text' => 'Nouveau'];
        $this->patchJson('/api/contents/'.$content->public_id, ['title' => 'Élia', 'summary' => null,
            'field_values' => [['field_definition_id' => $field->id, 'value_json' => $entries]],
        ])->assertOk();
        $this->assertCount(21, $content->fieldValues()->sole()->value_json[0]['values']);
    }

    public function test_group_schema_edits_retain_retired_values_and_restore_the_previous_structure(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $local = ContentType::create(['key' => 'local', 'name' => 'Local', 'scope_type' => 'project', 'project_id' => $project->id]);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $oldKey = '3363ef89-d63e-47a5-8b79-7fe75aecff66';
        $scaleKey = 'd8990a7e-ac4c-4a0c-9605-9ec8f3137473';
        $newKey = 'c7ca604f-0af2-4fc1-bb37-4208dd735d6f';
        $field = FieldDefinition::create(FieldSchema::definitionAttributes([
            'label' => 'Parcours', 'section' => 'Parcours', 'type' => 'repeatable', 'entry_fields' => [
                ['key' => $oldKey, 'label' => 'Ancien nom', 'type' => 'text', 'required' => true],
                ['key' => $scaleKey, 'label' => 'Niveau', 'type' => 'scale', 'levels' => 5],
            ],
        ], 'project', $project->id));
        $block = $content->blocks()->create(['block_type' => 'fields', 'title' => 'Parcours', 'field_schema' => [['field_definition_id' => $field->id]]]);
        $entries = [['id' => 'a3389499-94f8-4bee-adb1-a0e968a0cb42', 'label' => 'Formation', 'values' => [
            $oldKey => ['value_text' => 'Conservé'], $scaleKey => ['value_json' => ['level' => 4]],
        ]]];
        $content->fieldValues()->create(['field_definition_id' => $field->id, 'value_json' => $entries]);
        $url = "/api/projects/{$project->id}/contents/{$content->public_id}";
        $layout = $this->getJson("$url/fiche-layout")->json();
        $layout['tabs'][0]['placements'] = [['id' => '62d62476-6c05-4e1b-af03-9e4b1fd6e5e6', 'source' => 'fields:'.$block->public_id, 'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false]];
        $layout['block_updates'] = [['id' => $block->public_id, 'title' => 'Parcours', 'fields' => [[
            'id' => $field->id, 'label' => 'Parcours', 'type' => 'repeatable', 'section' => 'Parcours', 'entry_fields' => [
                ['key' => $scaleKey, 'label' => 'Maîtrise', 'type' => 'scale', 'levels' => 3],
                ['key' => $newKey, 'label' => 'Allié', 'type' => 'reference', 'reference_types' => [$local->id]],
            ],
        ]]]];
        $this->putJson("$url/fiche-layout", $layout)->assertUnprocessable();
        $this->assertDatabaseCount('content_revisions', 0);
        $layout['block_updates'][0]['fields'][0]['entry_fields'][0]['scale_strategy'] = 'preserve';
        $this->putJson("$url/fiche-layout", $layout)->assertOk();
        $schema = $block->fresh()->field_schema[0]['display_options']['entry_fields'];
        $this->assertSame([$scaleKey, $newKey, $oldKey], array_column($schema, 'key'));
        $this->assertTrue($schema[2]['retired']);
        $this->assertSame(3, $schema[0]['display_options']['scale_levels']);
        $this->assertSame(5, $field->fresh()->options_data['entry_fields'][1]['field_definition']['options_data']['levels']);
        $this->assertSame($entries, $content->fieldValues()->sole()->value_json);
        $payload = ['title' => 'Élia', 'summary' => null, 'field_values' => [['field_definition_id' => $field->id, 'value_json' => $entries]]];
        $this->patchJson('/api/contents/'.$content->public_id, $payload)->assertOk();
        $payload['field_values'][0]['value_json'][0]['values'][$oldKey]['value_text'] = 'Perdu';
        $this->patchJson('/api/contents/'.$content->public_id, $payload)->assertUnprocessable();
        $this->assertSame($entries, $content->fieldValues()->sole()->value_json);
        $this->postJson("$url/fiche-tab-templates", ['name' => 'Groupe', 'scope' => 'global', 'tab' => 'overview', 'version' => 1])->assertUnprocessable();
        $snapshot = DB::table('content_revisions')->where('content_id', $content->id)->where('label', 'Avant modification des champs')->value('id');
        $this->postJson('/api/contents/'.$content->public_id.'/revisions/'.$snapshot.'/restore')->assertOk();
        $this->assertSame([['field_definition_id' => $field->id]], $block->fresh()->field_schema);
        $this->assertSame($entries, $content->fieldValues()->sole()->value_json);
    }

    public function test_nested_group_dates_keep_stable_timeline_keys_and_references_remain_scoped(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $foreign = $other->contents()->create(['title' => 'Autre', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $groupKey = 'a7338e08-9d6c-4ac5-978d-1655a807e054';
        $dateKey = '2cac3692-f13e-446a-bd8d-28531c80825e';
        $referenceKey = 'cb45a806-9440-48e6-a650-020e49db299f';
        $schema = ['label' => 'Parcours', 'section' => 'Parcours', 'type' => 'repeatable', 'entry_fields' => [
            ['key' => $groupKey, 'label' => 'Étapes', 'type' => 'repeatable', 'entry_fields' => [
                ['key' => $dateKey, 'label' => 'Date', 'type' => 'temporal'],
                ['key' => $referenceKey, 'label' => 'Personne', 'type' => 'reference'],
            ]],
        ]];
        $field = FieldDefinition::create(FieldSchema::definitionAttributes($schema, 'project', $project->id));
        $rootId = 'e88245ae-f8b8-4296-84c6-a365bd713d6f';
        $childId = 'bb637da1-0569-45be-96f8-0921c2f883c1';
        $date = ['start' => 'An 42', 'precision' => 'approximate', 'timeline' => true];
        $entries = [['id' => $rootId, 'label' => 'Formation', 'values' => [$groupKey => ['value_json' => [
            ['id' => $childId, 'label' => 'Départ', 'values' => [$dateKey => ['value_json' => $date]]],
        ]]]]];
        $url = '/api/contents/'.$content->public_id;
        $payload = ['title' => 'Élia', 'summary' => null, 'field_values' => [['field_definition_id' => $field->id, 'value_json' => $entries]]];
        $this->patchJson($url, $payload)->assertOk();
        $links = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-links";
        $key = $this->getJson($links)->assertOk()->assertJsonCount(1, 'timeline')->assertJsonPath('timeline.0.date.precision', 'approximate')->json('timeline.0.key');
        $payload['field_values'][0]['value_json'][0]['values'][$groupKey]['value_json'][0]['values'][$dateKey]['value_json']['start'] = 'An 43';
        $this->patchJson($url, $payload)->assertOk();
        $this->getJson($links)->assertOk()->assertJsonCount(1, 'timeline')->assertJsonPath('timeline.0.key', $key)->assertJsonPath('timeline.0.date.start', 'An 43');
        $payload['field_values'][0]['value_json'][0]['values'][$groupKey]['value_json'][0]['values'][$referenceKey] = ['reference_content_id' => $foreign->id];
        $this->patchJson($url, $payload)->assertUnprocessable();
        unset($payload['field_values'][0]['value_json'][0]['values'][$groupKey]['value_json'][0]['values'][$referenceKey]);
        $payload['field_values'][0]['value_json'][0]['values'][$groupKey]['value_json'][0]['values'][$dateKey]['value_json']['timeline'] = false;
        $this->patchJson($url, $payload)->assertOk();
        $this->getJson($links)->assertOk()->assertJsonCount(0, 'timeline');
        $this->assertDatabaseCount('content_field_values', 1);
    }

    public function test_repeatable_groups_validate_typed_children_without_extra_canonical_rows(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $layoutUrl = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-layout";
        $key = '8841df60-e9cc-49ec-97c1-47683aa8ec21';
        $choice = 'fd55a349-e28a-4ff9-b830-ecfe31f54956';
        $reference = '288df591-e7eb-4af0-8b1b-c1f7e94f7e6e';
        $localType = ContentType::create(['key' => 'local', 'name' => 'Local', 'scope_type' => 'project', 'project_id' => $project->id]);
        $block = '1b7c35c0-7f5c-42ee-bbd6-18ef48ca64ec';
        $layout = $this->getJson($layoutUrl)->json();
        $layout['copies'] = [['id' => $block, 'source' => 'blank-fields', 'title' => 'Groupe', 'fields' => [[
            'label' => 'Parcours', 'type' => 'repeatable', 'section' => 'Groupe', 'entry_fields' => [
                ['key' => $key, 'label' => 'Accompli', 'type' => 'boolean', 'required' => true],
                ['key' => $choice, 'label' => 'Statut', 'type' => 'choice', 'choices' => ['Actif', 'Terminé']],
                ['key' => $reference, 'label' => 'Allié', 'type' => 'reference', 'reference_types' => [$localType->id]],
            ],
        ]]]];
        $layout['tabs'][0]['placements'] = [[
            'id' => '167ee864-b19f-44e8-8480-3f7f9e0eedc0', 'source' => 'fields:'.$block,
            'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false,
        ]];
        $invalid = $layout;
        $invalid['copies'][0]['fields'][0]['entry_fields'][1]['key'] = $key;
        $this->putJson($layoutUrl, $invalid)->assertUnprocessable();
        $this->assertDatabaseCount('field_definitions', 0);
        $invalid = $layout;
        $deep = ['key' => $key, 'label' => 'Imbriqué', 'type' => 'repeatable'];
        for ($depth = 0; $depth < 4; $depth++) {
            $deep = ['key' => $key, 'label' => 'Imbriqué', 'type' => 'repeatable', 'entry_fields' => [$deep]];
        }
        $invalid['copies'][0]['fields'][0]['entry_fields'] = [$deep];
        $this->putJson($layoutUrl, $invalid)->assertUnprocessable();
        $this->assertDatabaseCount('field_definitions', 0);
        $this->putJson($layoutUrl, $layout)->assertOk();
        $library = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-tab-templates";
        $this->postJson($library, ['name' => 'Groupe', 'scope' => 'global', 'tab' => 'overview', 'version' => 1])->assertUnprocessable();
        $this->assertDatabaseCount('fiche_tab_templates', 0);
        $this->postJson($library, ['name' => 'Groupe', 'scope' => 'project', 'tab' => 'overview', 'version' => 1])->assertCreated();
        $field = $content->blocks()->sole()->field_schema[0]['field_definition_id'];
        $entry = ['id' => '51ca57b0-9c3d-4bd1-900d-f151382423e8', 'label' => 'Formation', 'values' => [
            $key => ['value_boolean' => false], $choice => ['value_text' => 'Actif'],
        ]];
        $url = '/api/contents/'.$content->public_id;
        $payload = ['title' => 'Élia', 'summary' => null, 'field_values' => [['field_definition_id' => $field, 'value_json' => [$entry]]]];
        $this->patchJson($url, $payload)->assertOk()->assertJsonPath('field_values.0.value_json.0.values.'.$key.'.value_boolean', false);
        $this->assertDatabaseCount('field_definitions', 1);
        $this->assertDatabaseCount('content_field_values', 1);
        foreach ([
            [$key => ['value_text' => 'incorrect']],
            [$key => ['value_boolean' => false], $choice => ['value_text' => 'Autre']],
            [$key => ['value_boolean' => false], 'unknown' => ['value_text' => 'inconnu']],
            [],
        ] as $values) {
            $payload['field_values'][0]['value_json'][0]['values'] = $values;
            $this->patchJson($url, $payload)->assertUnprocessable();
        }
        $this->assertSame([$entry], $content->fieldValues()->sole()->value_json);
        $payload['field_values'][0]['value_json'][0]['values'] = [$key => ['value_state' => 'unknown']];
        $this->patchJson($url, $payload)->assertOk();

    }
}
