<?php

namespace Tests\Feature;

use App\FieldSchema;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AttachmentFieldTest extends TestCase
{
    use RefreshDatabase;

    public function test_attachment_fields_inside_repeated_groups_use_the_same_ownership_validation(): void
    {
        Storage::fake('local');
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $other = $project->contents()->create(['title' => 'Kael', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $url = '/api/contents/'.$content->public_id;
        $file = $this->post("$url/attachments", ['file' => UploadedFile::fake()->createWithContent('source.txt', 'Source')], ['Accept' => 'application/json'])->assertCreated()->json('public_id');
        $foreign = $this->post('/api/contents/'.$other->public_id.'/attachments', ['file' => UploadedFile::fake()->createWithContent('autre.txt', 'Autre')], ['Accept' => 'application/json'])->assertCreated()->json('public_id');
        $key = 'c333e440-59fb-4ab9-b50f-71c56d0f62c5';
        $field = FieldDefinition::create(FieldSchema::definitionAttributes([
            'label' => 'Sources', 'section' => 'Sources', 'type' => 'repeatable', 'entry_fields' => [
                ['key' => $key, 'label' => 'Fichier', 'type' => 'attachment'],
            ],
        ], 'project', $project->id));
        $content->blocks()->create(['block_type' => 'fields', 'title' => 'Sources', 'field_schema' => [['field_definition_id' => $field->id]]]);
        $payload = ['title' => 'Élia', 'summary' => null, 'field_values' => [['field_definition_id' => $field->id, 'value_json' => [[
            'id' => '092fe0a6-4265-4de5-8bc4-08b19e5a192c', 'label' => 'Source', 'values' => [$key => ['value_json' => ['attachment' => $file]]],
        ]]]]];
        $this->patchJson($url, $payload)->assertOk();
        $payload['field_values'][0]['value_json'][0]['values'][$key]['value_json']['attachment'] = $foreign;
        $this->patchJson($url, $payload)->assertUnprocessable();
        $this->assertSame($file, $content->fieldValues()->sole()->value_json[0]['values'][$key]['value_json']['attachment']);
    }

    public function test_attachment_fields_select_only_owned_files_and_keep_missing_references_without_deleting_files(): void
    {
        Storage::fake('local');
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $content = $project->contents()->create(['title' => 'Élia', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $other = $project->contents()->create(['title' => 'Kael', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $url = '/api/contents/'.$content->public_id;
        $file = $this->post("$url/attachments", ['file' => UploadedFile::fake()->createWithContent('source.txt', 'Source')], ['Accept' => 'application/json'])->assertCreated()->json('public_id');
        $foreign = $this->post('/api/contents/'.$other->public_id.'/attachments', ['file' => UploadedFile::fake()->createWithContent('autre.txt', 'Autre')], ['Accept' => 'application/json'])->assertCreated()->json('public_id');
        $resource = $content->resources()->sole();
        $layoutUrl = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($layoutUrl)->json();
        $blockId = 'c26d4b3a-64ba-4a58-9c1b-9ab9601516bc';
        $layout['copies'] = [['id' => $blockId, 'source' => 'blank-fields', 'title' => 'Sources', 'fields' => [['label' => 'Fichier', 'section' => 'Sources', 'type' => 'attachment']]]];
        $layout['tabs'][0]['placements'] = [['id' => 'efc0c069-b190-43da-a46c-767f9643b27b', 'source' => 'fields:'.$blockId, 'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false]];
        $this->putJson($layoutUrl, $layout)->assertOk();
        $block = $content->blocks()->sole();
        $field = $block->field_schema[0]['field_definition_id'];
        $payload = ['title' => 'Élia', 'summary' => null, 'field_values' => [['field_definition_id' => $field, 'value_json' => ['attachment' => $file]]]];
        $this->patchJson($url, $payload)->assertOk();
        $payload['field_values'][0]['value_json']['attachment'] = $foreign;
        $this->patchJson($url, $payload)->assertUnprocessable()->assertJsonValidationErrors('value_json.attachment');
        $this->assertSame(['attachment' => $file], $content->fieldValues()->sole()->value_json);
        $schema = $block->field_schema;
        $schema[0]['default_value'] = ['value_json' => ['attachment' => $file]];
        $block->update(['field_schema' => $schema]);
        $this->postJson("/api/projects/{$project->id}/contents/{$content->public_id}/fiche-tab-templates", ['name' => 'Sources', 'scope' => 'global', 'tab' => 'overview', 'version' => 1])->assertUnprocessable();
        $this->deleteJson("$url/attachments/$file")->assertNoContent();
        $payload['field_values'][0]['value_json']['attachment'] = $file;
        $this->patchJson($url, $payload)->assertOk();
        $this->get("$url/attachments/$file")->assertNotFound();
        $this->patchJson($url, ['title' => 'Élia', 'summary' => null, 'field_values' => []])->assertOk();
        $this->assertDatabaseCount('content_field_values', 0);
        Storage::disk('local')->assertExists($resource->location);

    }
}
