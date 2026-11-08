<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProjectIdeaTest extends TestCase
{
    use RefreshDatabase;

    public function test_custom_columns_preserve_ideas_and_search_runs_before_pagination(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/ideas";
        $idea = $this->postJson($url, ['body' => 'Indice unique'])->assertCreated()->json('id');
        $this->patchJson("$url/$idea", ['column_key' => 'retained'])->assertNoContent();
        $this->postJson("/api/projects/{$other->id}/ideas", ['body' => 'Indice unique'])->assertCreated();

        $this->putJson("$url/columns", ['columns' => [
            ['key' => 'inbox', 'label' => 'Boîte'],
            ['key' => 'new', 'label' => 'À lire'],
        ]])->assertNoContent();
        $this->assertDatabaseHas('project_ideas', ['id' => $idea, 'column_key' => 'inbox', 'body' => 'Indice unique']);
        $this->patchJson("$url/$idea", ['column_key' => 'retained'])->assertUnprocessable();

        for ($index = 0; $index < 51; $index++) {
            $this->postJson($url, ['body' => "Autre idée $index"])->assertCreated();
        }

        $this->getJson("$url?search=unique&column=inbox")->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $idea)->assertJsonPath('columns.0.label', 'Boîte');
        $this->getJson("/api/projects/{$other->id}/ideas")->assertOk()->assertJsonPath('columns.0.key', 'new');
    }

    public function test_idea_can_be_converted_to_a_scene_only_in_its_project(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/ideas";
        $idea = $this->postJson($url, ['title' => 'Le départ', 'body' => 'Le bateau quitte le port.'])->assertCreated()->json('id');
        $work = $this->postJson("/api/projects/{$project->id}/narration", ['title' => 'Roman'])->assertCreated()->json('public_id');
        $outside = $this->postJson("/api/projects/{$other->id}/narration", ['title' => 'Autre roman'])->assertCreated()->json('public_id');
        $input = ['title' => 'Le départ', 'request_id' => (string) Str::uuid()];
        $this->postJson("$url/$idea/convert", $input + ['work' => $outside])->assertNotFound();

        $scene = $this->postJson("$url/$idea/convert", $input + ['work' => $work])->assertCreated()->json('public_id');
        $this->postJson("$url/$idea/convert", $input + ['work' => $work])->assertOk()->assertJsonPath('public_id', $scene);
        $this->getJson("/api/projects/{$project->id}/narration")->assertOk()->assertJsonCount(1, '0.scenes')
            ->assertJsonPath('0.scenes.0.public_id', $scene);
        $this->getJson("/api/contents/$scene")->assertOk()->assertJsonPath('origin_idea.id', $idea)
            ->assertJsonPath('blocks.0.body', 'Le bateau quitte le port.');
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.conversions.0.public_id', $scene);
    }

    public function test_capture_is_separate_from_catalogue_and_conversion_preserves_provenance(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::create(['key' => 'personnage', 'name' => 'Personnage']);
        $url = "/api/projects/{$project->id}/ideas";
        $this->postJson($url, ['body' => ''])->assertUnprocessable();
        $idea = $this->postJson($url, ['body' => 'Une capitaine sans navire'])->assertCreated()->json('id');
        $this->getJson("/api/contents?project_id={$project->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->patchJson("/api/projects/{$other->id}/ideas/$idea", ['column_key' => 'retained'])->assertNotFound();
        $this->patchJson("$url/$idea", ['column_key' => 'retained'])->assertNoContent();

        $input = ['title' => 'La capitaine', 'content_type_id' => $type->id, 'request_id' => (string) Str::uuid()];
        $first = $this->postJson("$url/$idea/convert", $input)->assertCreated()->json('public_id');
        $this->postJson("$url/$idea/convert", $input)->assertOk()->assertJsonPath('public_id', $first);
        $this->postJson("$url/$idea/convert", array_replace($input, ['request_id' => (string) Str::uuid()]))->assertCreated();
        $this->getJson("/api/contents/$first")->assertOk()
            ->assertJsonPath('work_status_key', 'draft')->assertJsonPath('blocks.0.body', 'Une capitaine sans navire');
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.column_key', 'retained')
            ->assertJsonCount(2, 'data.0.conversions');

        $this->patchJson("$url/$idea", ['archived' => true])->assertNoContent();
        $this->getJson($url)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("$url?archive=1")->assertOk()->assertJsonPath('data.0.id', $idea);
    }
}
