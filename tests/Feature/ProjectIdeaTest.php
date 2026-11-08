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
