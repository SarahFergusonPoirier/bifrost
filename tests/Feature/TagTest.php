<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Tag;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TagTest extends TestCase
{
    use RefreshDatabase;

    public function test_tags_can_be_listed_in_alphabetical_order(): void
    {
        Tag::create(['name' => 'Zoologie']);
        Tag::create(['name' => 'Animation']);
        Tag::create(['name' => 'Lecture']);

        $response = $this->getJson('/api/tags');

        $response->assertOk()
            ->assertJsonCount(3);

        $names = collect($response->json())->pluck('name')->all();

        $this->assertSame(
            ['Animation', 'Lecture', 'Zoologie'],
            $names
        );
    }

    public function test_tag_can_be_created(): void
    {
        $response = $this->postJson('/api/tags', [
            'name' => 'Programmation',
        ]);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Programmation',
            ]);

        $this->assertDatabaseHas('tags', [
            'name' => 'Programmation',
        ]);
    }

    public function test_tag_name_is_trimmed_when_created(): void
    {
        $response = $this->postJson('/api/tags', [
            'name' => '  Lecture  ',
        ]);

        $response->assertCreated()
            ->assertJsonFragment([
                'name' => 'Lecture',
            ]);

        $this->assertDatabaseHas('tags', [
            'name' => 'Lecture',
        ]);

        $this->assertDatabaseMissing('tags', [
            'name' => '  Lecture  ',
        ]);
    }

    public function test_tag_cannot_be_created_without_a_name(): void
    {
        $response = $this->postJson('/api/tags', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_tag_cannot_be_created_with_an_empty_name(): void
    {
        $response = $this->postJson('/api/tags', [
            'name' => '   ',
        ]);

        $response->assertUnprocessable();
    }

    public function test_tag_name_cannot_exceed_255_characters(): void
    {
        $response = $this->postJson('/api/tags', [
            'name' => str_repeat('a', 256),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_existing_tag_is_returned_when_created_again(): void
    {
        $existingTag = Tag::create([
            'name' => 'Programmation',
        ]);

        $response = $this->postJson('/api/tags', [
            'name' => 'Programmation',
        ]);

        $response->assertOk()
            ->assertJsonFragment([
                'id' => $existingTag->id,
                'name' => 'Programmation',
            ]);

        $this->assertDatabaseCount('tags', 1);
    }

    public function test_tag_creation_ignores_case_when_checking_duplicates(): void
    {
        $existingTag = Tag::create([
            'name' => 'Programmation',
        ]);

        $response = $this->postJson('/api/tags', [
            'name' => 'PROGRAMMATION',
        ]);

        $response->assertOk()
            ->assertJsonFragment([
                'id' => $existingTag->id,
                'name' => 'Programmation',
            ]);

        $this->assertDatabaseCount('tags', 1);
    }

    public function test_tag_can_be_deleted(): void
    {
        $tag = Tag::create([
            'name' => 'Lecture',
        ]);

        $response = $this->deleteJson("/api/tags/{$tag->id}");

        $response->assertOk()
            ->assertJson([
                'message' => 'Tag supprimé avec succès.',
            ]);

        $this->assertDatabaseMissing('tags', [
            'id' => $tag->id,
        ]);
    }

    public function test_deleting_tag_detaches_it_from_its_projects(): void
    {
        $project = Project::create([
            'name' => 'Projet test',
            'description' => 'Description test',
        ]);

        $tag = Tag::create([
            'name' => 'Lecture',
        ]);

        $project->tags()->attach($tag->id);

        $this->assertDatabaseHas('project_tag', [
            'project_id' => $project->id,
            'tag_id' => $tag->id,
        ]);

        $response = $this->deleteJson("/api/tags/{$tag->id}");

        $response->assertOk();

        $this->assertDatabaseMissing('tags', [
            'id' => $tag->id,
        ]);

        $this->assertDatabaseMissing('project_tag', [
            'project_id' => $project->id,
            'tag_id' => $tag->id,
        ]);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
        ]);
    }
}