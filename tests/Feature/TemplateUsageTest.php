<?php

namespace Tests\Feature;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateUsageTest extends TestCase
{
    use RefreshDatabase;

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
