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
