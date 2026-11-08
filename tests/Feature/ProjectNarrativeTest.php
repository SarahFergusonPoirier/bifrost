<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectNarrativeTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_scene_has_one_identity_across_order_and_editing_views(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $first = $this->postJson("$url/$work/scenes", ['title' => 'Départ'])->assertCreated()->json('public_id');
        $second = $this->postJson("$url/$work/scenes", ['title' => 'Arrivée'])->assertCreated()->json('public_id');
        $this->postJson("/api/projects/{$other->id}/narration/$work/scenes", ['title' => 'Externe'])->assertNotFound();

        $this->putJson("$url/$work/scenes/order", ['scenes' => [$second]])->assertUnprocessable();
        $this->putJson("$url/$work/scenes/order", ['scenes' => [$second, $first]])->assertNoContent();
        $this->patchJson("/api/contents/$second", [
            'title' => 'Retour', 'summary' => 'Retour au port', 'work_status_key' => 'completed',
            'blocks' => [['body' => 'Le navire accosta.']],
        ])->assertOk()->assertJsonPath('blocks.0.body', 'Le navire accosta.');

        $this->getJson($url)->assertOk()->assertJsonPath('0.scenes.0.public_id', $second)
            ->assertJsonPath('0.scenes.0.title', 'Retour')->assertJsonPath('0.scenes.0.work_status_key', 'completed')
            ->assertJsonPath('0.scenes.1.public_id', $first);
        $this->assertDatabaseCount('contents', 3);
        $this->assertDatabaseCount('project_narrative_scenes', 2);
    }
}
