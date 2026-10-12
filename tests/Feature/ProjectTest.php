<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    use RefreshDatabase;

    // 1. Vérifier que les projets peuvent être récupérés.
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

    // 2. Vérifier qu'un projet peut être créé.
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

    // 3. Vérifier qu'un projet sans nom est refusé.
    public function test_projects_cannot_be_created_without_a_name(): void
    {
        $response = $this->postJson('/api/projects', [
            'description' => 'Description test',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    // 4. Vérifier qu'un nom de plus de 255 caractères est refusé.
    public function test_projects_cannot_be_created_with_a_name_too_long(): void
    {
        $response = $this->postJson('/api/projects', [
            'name' => str_repeat('a', 256),
            'description' => 'Description test',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    // 5. Vérifier qu'un projet peut être créé sans description.
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

    // 6. Vérifier que plusieurs projets apparaissent dans la liste.
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
}
