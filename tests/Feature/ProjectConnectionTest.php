<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectConnectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_graph_preserves_isolated_nodes_and_persisted_positions_within_a_project(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::create(['name' => 'Lieu', 'key' => 'lieu']);
        $attributes = ['scope_type' => 'project', 'content_type_id' => $type->id];
        $source = $project->contents()->create($attributes + ['title' => 'Source']);
        $target = $project->contents()->create($attributes + ['title' => 'Cible']);
        $project->contents()->create($attributes + ['title' => 'Isolée']);
        $foreign = $other->contents()->create($attributes + ['title' => 'Extérieure']);
        $url = "/api/projects/{$project->id}/connections";

        $this->postJson($url, ['source' => $source->public_id, 'target' => $foreign->public_id, 'type_key' => 'contient'])
            ->assertNotFound();
        $input = ['source' => $source->public_id, 'target' => $target->public_id, 'type_key' => 'contient'];
        $edge = $this->postJson($url, $input)->assertCreated()->json('id');
        $this->postJson($url, $input)->assertOk()->assertJsonPath('id', $edge);

        $this->putJson("/api/projects/{$project->id}/graph/positions/{$source->public_id}", ['x' => 0.25, 'y' => 0.75])
            ->assertNoContent();
        $graph = $this->getJson($url)->assertOk()->assertJsonCount(3, 'nodes')->assertJsonCount(1, 'edges')
            ->assertJsonPath('edges.0.source_content_id', $source->id)->assertJsonPath('edges.0.target_content_id', $target->id);
        $this->assertSame(0.25, collect($graph->json('nodes'))->firstWhere('id', $source->id)['x']);

        $this->deleteJson("/api/projects/{$other->id}/connections/$edge")->assertNotFound();
        $this->deleteJson("$url/$edge")->assertNoContent();
        $this->getJson($url)->assertOk()->assertJsonCount(3, 'nodes')->assertJsonCount(0, 'edges');
    }
}
