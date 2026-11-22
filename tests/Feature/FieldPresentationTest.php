<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FieldPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_variants_can_add_project_scoped_members_without_mutating_the_global_group(): void
    {
        $type = ContentType::create(['key' => 'fiche', 'name' => 'Fiche']);
        $project = Project::create(['name' => 'Projet']);
        $local = ContentType::create(['key' => 'local', 'name' => 'Local', 'scope_type' => 'project', 'project_id' => $project->id]);
        $field = ['label' => 'Parcours', 'section' => 'Parcours', 'type' => 'repeatable', 'entry_fields' => []];
        $global = $this->postJson('/api/content-templates', ['name' => 'Global', 'content_type_id' => $type->id, 'fields' => [$field]])->assertCreated()->json();
        $field['id'] = $this->getJson('/api/content-templates/'.$global['id'])->json('versions.0.fields.0.field_definition_id');
        $field['entry_fields'] = [['key' => '4563e026-5aaa-4b55-8ad1-680fc538e918', 'label' => 'Allié', 'type' => 'reference', 'reference_types' => [$local->id]]];
        $variant = $this->postJson('/api/content-templates', ['name' => 'Projet', 'project_id' => $project->id, 'content_type_id' => $type->id,
            'base_version_id' => $global['version_id'], 'fields' => [$field],
        ])->assertCreated()->json();
        $this->getJson('/api/content-templates/'.$variant['id'])->assertOk()
            ->assertJsonPath('versions.0.fields.0.display_options.entry_fields.0.field_definition.options_data.content_type_ids', [$local->id]);
        $this->postJson('/api/content-templates/'.$global['id'].'/versions', ['from_version_id' => $global['version_id'], 'fields' => [$field]])->assertUnprocessable();
        $this->getJson('/api/content-templates/'.$global['id'])->assertOk()->assertJsonCount(1, 'versions')
            ->assertJsonPath('versions.0.fields.0.field_definition.options_data.entry_fields', []);
        $this->assertDatabaseCount('field_definitions', 1);
    }

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
