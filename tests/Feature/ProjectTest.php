<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    public function test_projects_can_be_listed(): void
    {
        Project::create([
            'name' => 'Projet test',
            'description' => 'Description test',
        ]);

        $response = $this->getJson('/api/projects');

        $response->assertOk()
            ->assertJsonFragment([
                'name' => 'Projet test',
                'description' => 'Description test',
            ]);
    }

    public function test_projects_can_be_created(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => 'Nouveau projet',
            'description' => 'Description du nouveau projet',
        ]);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Nouveau projet',
                'description' => 'Description du nouveau projet',
            ]);

        $this->assertDatabaseHas('projects', [
            'name' => 'Nouveau projet',
            'description' => 'Description du nouveau projet',
        ]);
    }

    public function test_projects_cannot_be_created_without_a_name(): void
    {
        $response = $this->postJson('/api/projects', [
            'description' => 'Description test',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_projects_cannot_be_created_with_a_name_too_long(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => str_repeat('a', 256),
            'description' => 'Description test',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_projects_can_be_created_without_a_description(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => 'Projet sans description',
        ]);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Projet sans description',
            ]);
    }

    public function test_multiple_projects_can_be_listed(): void
    {
        Project::create([
            'name' => 'Premier projet',
        ]);

        Project::create([
            'name' => 'Deuxième projet',
        ]);

        $response = $this->getJson('/api/projects');

        $response->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment([
                'name' => 'Premier projet',
            ])
            ->assertJsonFragment([
                'name' => 'Deuxième projet',
            ]);
    }

    public function test_project_can_be_created_with_tags(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => 'Projet avec tags',
            'tags' => ['Lecture', 'Programmation'],
        ]);

        $response->assertCreated()
            ->assertJsonFragment(['name' => 'Projet avec tags'])
            ->assertJsonFragment(['name' => 'Lecture'])
            ->assertJsonFragment(['name' => 'Programmation']);

        $project = Project::where('name', 'Projet avec tags')->firstOrFail();

        $this->assertDatabaseHas('tags', ['name' => 'Lecture']);
        $this->assertDatabaseHas('tags', ['name' => 'Programmation']);
        $this->assertCount(2, $project->tags);
    }

    public function test_project_creation_reuses_existing_tags_case_insensitively(): void
    {
        $tag = Tag::create(['name' => 'Lecture']);

        $response = $this->postJson('/api/projects', [
            'name' => 'Projet lecture',
            'tags' => ['LECTURE', 'Lecture'],
        ]);

        $response->assertCreated();

        $project = Project::where('name', 'Projet lecture')->firstOrFail();

        $this->assertCount(1, $project->tags);
        $this->assertSame($tag->id, $project->tags->first()->id);
        $this->assertDatabaseCount('tags', 1);
    }

    public function test_project_creation_trims_tag_names(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => 'Projet avec espaces',
            'tags' => ['  Lecture  ', 'Programmation'],
        ]);

        $response->assertCreated();

        $project = Project::where(
            'name',
            'Projet avec espaces'
        )->firstOrFail();

        $this->assertEqualsCanonicalizing(
            ['Lecture', 'Programmation'],
            $project->tags->pluck('name')->all()
        );

        $this->assertDatabaseMissing('tags', [
            'name' => '  Lecture  ',
        ]);
    }
    
    public function test_project_response_includes_its_tags_when_listed(): void
    {
        $project = Project::create(['name' => 'Projet affiché']);
        $tag = Tag::create(['name' => 'Lecture']);
        $project->tags()->attach($tag->id);

        $response = $this->getJson('/api/projects');

        $response->assertOk()
            ->assertJsonFragment([
                'name' => 'Projet affiché',
            ])
            ->assertJsonFragment([
                'name' => 'Lecture',
            ]);
    }

    public function test_projects_can_be_filtered_by_tag_id(): void
    {
        $tag = Tag::create(['name' => 'Lecture']);

        $matchingProject = Project::create(['name' => 'Projet lecture']);
        $matchingProject->tags()->attach($tag->id);

        Project::create(['name' => 'Projet sans tag']);

        $response = $this->getJson('/api/projects?tag_id=' . $tag->id);

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment([
                'name' => 'Projet lecture',
            ])
            ->assertJsonMissing([
                'name' => 'Projet sans tag',
            ]);
    }

    public function test_project_tags_can_be_replaced_when_updated(): void
    {
        $project = Project::create(['name' => 'Projet à modifier']);

        $oldTag = Tag::create(['name' => 'Ancien tag']);
        $newTag = Tag::create(['name' => 'Nouveau tag']);

        $project->tags()->attach($oldTag->id);

        $response = $this->putJson('/api/projects/' . $project->id, [
            'name' => 'Projet à modifier',
            'tags' => ['Nouveau tag'],
        ]);

        $response->assertOk()
            ->assertJsonFragment(['name' => 'Nouveau tag']);

        $project->refresh();

        $this->assertEquals(
            [$newTag->id],
            $project->tags->pluck('id')->all()
        );

        $this->assertDatabaseMissing('project_tag', [
            'project_id' => $project->id,
            'tag_id' => $oldTag->id,
        ]);
    }

    public function test_project_tags_are_preserved_when_tags_are_omitted_from_update(): void
    {
        $project = Project::create(['name' => 'Projet conservé']);
        $tag = Tag::create(['name' => 'Lecture']);

        $project->tags()->attach($tag->id);

        $response = $this->putJson('/api/projects/' . $project->id, [
            'name' => 'Projet renommé',
        ]);

        $response->assertOk();

        $this->assertTrue(
            $project->fresh()->tags->contains('id', $tag->id)
        );
    }

    public function test_empty_tags_array_removes_all_project_tag_associations(): void
    {
        $project = Project::create(['name' => 'Projet sans tags']);
        $tag = Tag::create(['name' => 'Lecture']);

        $project->tags()->attach($tag->id);

        $response = $this->putJson('/api/projects/' . $project->id, [
            'name' => 'Projet sans tags',
            'tags' => [],
        ]);

        $response->assertOk();

        $this->assertDatabaseMissing('project_tag', [
            'project_id' => $project->id,
            'tag_id' => $tag->id,
        ]);

        $this->assertCount(0, $project->fresh()->tags);
    }

    public function test_duplicate_tag_names_do_not_create_duplicate_associations(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => 'Projet tags dupliqués',
            'tags' => ['Lecture', 'Lecture', 'LECTURE'],
        ]);

        $response->assertCreated();

        $project = Project::where(
            'name',
            'Projet tags dupliqués'
        )->firstOrFail();

        $this->assertCount(1, $project->tags);
        $this->assertDatabaseCount('tags', 1);
        $this->assertDatabaseCount('project_tag', 1);
    }
}