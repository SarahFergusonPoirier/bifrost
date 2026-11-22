<?php

namespace Tests\Feature;

use App\FieldSchema;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RepeatableFieldsTest extends TestCase
{
    use RefreshDatabase;

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
