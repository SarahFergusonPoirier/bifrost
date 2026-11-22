<?php

namespace Tests\Feature;

use App\Models\ContentType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FieldPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_empty_value_rules_are_versioned_and_can_return_to_inheritance(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $field = ['label' => 'Description', 'section' => 'Identité', 'type' => 'text', 'hide_empty' => true];
        $template = $this->postJson('/api/content-templates', ['name' => 'Personnalisé', 'content_type_id' => $type->id, 'fields' => [$field]])->assertCreated()->json();
        $url = '/api/content-templates/'.$template['id'];
        $read = $this->getJson($url)->assertOk()->assertJsonPath('versions.0.fields.0.display_options.hide_empty', true)->json();
        $field['id'] = $read['versions'][0]['fields'][0]['field_definition_id'];
        $field['hide_empty'] = 'invalid';
        $this->postJson("$url/versions", ['from_version_id' => $template['version_id'], 'fields' => [$field]])->assertUnprocessable();
        $this->assertDatabaseCount('template_versions', 1);
        $field['hide_empty'] = null;
        $this->postJson("$url/versions", ['from_version_id' => $template['version_id'], 'fields' => [$field]])->assertCreated();
        $this->getJson($url)->assertOk()->assertJsonPath('versions.0.fields.0.display_options.hide_empty', true)
            ->assertJsonMissingPath('versions.1.fields.0.display_options.hide_empty');

    }
}
