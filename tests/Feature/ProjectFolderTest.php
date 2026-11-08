<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectFolderTest extends TestCase
{
    use RefreshDatabase;

    public function test_folders_can_be_nested_and_contents_moved_without_crossing_projects(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre projet']);
        $type = ContentType::create(['key' => 'document', 'name' => 'Document']);
        $url = "/api/projects/{$project->id}/folders";
        $parent = $this->postJson($url, ['name' => 'Notes', 'parent_id' => null])->assertCreated()->json('id');
        $child = $this->postJson($url, ['name' => 'Sources', 'parent_id' => $parent])->assertCreated()->json('id');
        $foreign = $this->postJson("/api/projects/{$other->id}/folders", ['name' => 'Privé', 'parent_id' => null])
            ->assertCreated()->json('id');

        $this->putJson("$url/$parent", ['name' => 'Notes', 'parent_id' => $child])->assertUnprocessable();
        $this->putJson("$url/$child", ['name' => 'Recherche', 'parent_id' => $parent])->assertOk();
        $content = $this->postJson('/api/contents', [
            'title' => 'Article', 'project_id' => $project->id, 'content_type_id' => $type->id, 'folder_id' => $child,
        ])->assertCreated()->json('public_id');

        $this->getJson("/api/contents?project_id={$project->id}&folder_id=$child")->assertOk()->assertJsonPath('data.0.public_id', $content);
        $this->getJson("/api/contents?project_id={$project->id}&folder_id=0")->assertOk()->assertJsonCount(0, 'data');
        $this->putJson("$url/$parent/contents/$content")->assertNoContent();
        $this->putJson("$url/$parent/contents/$content")->assertNoContent();
        $this->getJson("/api/contents?project_id={$project->id}&folder_id=$parent")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.public_id', $content);
        $this->getJson("/api/projects/{$project->id}/tree")->assertOk()->assertJsonCount(2);
        $this->patchJson("/api/contents/$content", [
            'title' => 'Article', 'summary' => null, 'work_status_key' => 'completed',
            'blocks' => [['body' => 'Un indice dans le texte']],
        ])->assertOk();
        $this->getJson("/api/contents?project_id={$project->id}&folder_id=$parent&search=indice&type={$type->id}&status=completed")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.public_id', $content);
        $this->getJson("/api/contents?project_id={$project->id}&search=indice&status=draft")
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/contents?project_id={$other->id}&search=indice")
            ->assertOk()->assertJsonCount(0, 'data');
        $this->deleteJson("$url/$parent")->assertNoContent();
        $this->getJson($url)->assertOk()->assertJsonPath('0.parent_id', null);
        $this->getJson("/api/contents?project_id={$project->id}&folder_id=$child")
            ->assertOk()->assertJsonPath('data.0.public_id', $content);

        $placement = "/api/projects/{$project->id}/contents/$content/placement";
        $this->putJson($placement, ['folder_id' => $foreign])->assertUnprocessable();
        $this->putJson($placement, ['folder_id' => null])->assertOk();
        $this->getJson("/api/contents?project_id={$project->id}&folder_id=0")->assertOk()->assertJsonPath('data.0.public_id', $content);
        $this->deleteJson("$url/$child")->assertNoContent();
    }
}
