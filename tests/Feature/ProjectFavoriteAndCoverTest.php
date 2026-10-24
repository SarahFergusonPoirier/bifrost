<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectFavoriteAndCoverTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
    }

    public function test_project_can_be_marked_as_favorite(): void
    {
        $project = Project::create([
            'name' => 'Projet favori',
            'is_favorite' => false,
        ]);

        $response = $this->patchJson(
            "/api/projects/{$project->id}/favorite",
            [
                'is_favorite' => true,
            ]
        );

        $response->assertOk()
            ->assertJsonPath('id', $project->id)
            ->assertJsonPath('is_favorite', true);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'is_favorite' => true,
        ]);
    }

    public function test_project_can_be_removed_from_favorites(): void
    {
        $project = Project::create([
            'name' => 'Projet non favori',
            'is_favorite' => true,
        ]);

        $response = $this->patchJson(
            "/api/projects/{$project->id}/favorite",
            [
                'is_favorite' => false,
            ]
        );

        $response->assertOk()
            ->assertJsonPath('is_favorite', false);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'is_favorite' => false,
        ]);
    }

    public function test_favorite_update_requires_a_boolean_value(): void
    {
        $project = Project::create([
            'name' => 'Projet favori',
            'is_favorite' => false,
        ]);

        $response = $this->patchJson(
            "/api/projects/{$project->id}/favorite",
            [
                'is_favorite' => 'invalid',
            ]
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('is_favorite');

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'is_favorite' => false,
        ]);
    }

    public function test_project_can_be_created_with_a_cover_image(): void
    {
        $image = UploadedFile::fake()->create(
            'cover.jpg',
            10,
            'image/jpeg'
        );

        $response = $this->post('/api/projects', [
            'name' => 'Projet avec couverture',
            'description' => 'Un projet avec une image.',
            'cover_image' => $image,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'Projet avec couverture');

        $project = Project::where(
            'name',
            'Projet avec couverture'
        )->firstOrFail();

        $this->assertNotNull($project->cover_image);

        Storage::disk('public')->assertExists(
            $project->cover_image
        );

        $response->assertJsonPath(
            'cover_image',
            $project->cover_image
        );
    }

    public function test_project_cover_can_be_replaced(): void
    {
        $oldCoverPath = 'project-covers/old-cover.jpg';

        Storage::disk('public')->put(
            $oldCoverPath,
            'ancienne couverture'
        );

        $project = Project::create([
            'name' => 'Projet à modifier',
            'cover_image' => $oldCoverPath,
        ]);

        $newImage = UploadedFile::fake()->create(
            'new-cover.jpg',
            10,
            'image/jpeg'
        );

        $response = $this->post(
            "/api/projects/{$project->id}",
            [
                '_method' => 'PUT',
                'name' => 'Projet à modifier',
                'description' => '',
                'cover_image' => $newImage,
            ],
            [
                'Accept' => 'application/json',
            ]
        );

        $response->assertOk();

        $project->refresh();

        $this->assertNotNull($project->cover_image);
        $this->assertNotSame(
            $oldCoverPath,
            $project->cover_image
        );

        Storage::disk('public')->assertMissing($oldCoverPath);

        Storage::disk('public')->assertExists(
            $project->cover_image
        );

        $response->assertJsonPath(
            'cover_image',
            $project->cover_image
        );
    }

    public function test_project_cover_can_be_removed(): void
    {
        $coverPath = 'project-covers/cover-to-remove.jpg';

        Storage::disk('public')->put(
            $coverPath,
            'couverture à retirer'
        );

        $project = Project::create([
            'name' => 'Projet sans couverture',
            'cover_image' => $coverPath,
        ]);

        $response = $this->putJson(
            "/api/projects/{$project->id}",
            [
                'name' => 'Projet sans couverture',
                'remove_cover_image' => true,
            ]
        );

        $response->assertOk()
            ->assertJsonPath('cover_image', null);

        $this->assertNull(
            $project->fresh()->cover_image
        );

        Storage::disk('public')->assertMissing($coverPath);
    }

    public function test_project_cannot_be_created_with_an_invalid_cover_file(): void
    {
        $file = UploadedFile::fake()->create(
            'document.txt',
            10,
            'text/plain'
        );

        $response = $this->post('/api/projects', [
            'name' => 'Projet avec fichier invalide',
            'cover_image' => $file,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('cover_image');

        $this->assertDatabaseMissing('projects', [
            'name' => 'Projet avec fichier invalide',
        ]);
    }

    public function test_deleting_a_project_also_deletes_its_cover_image(): void
    {
        $coverPath = 'project-covers/cover-to-delete.jpg';

        Storage::disk('public')->put(
            $coverPath,
            'couverture du projet'
        );

        $project = Project::create([
            'name' => 'Projet à supprimer',
            'cover_image' => $coverPath,
        ]);

        $response = $this->deleteJson(
            "/api/projects/{$project->id}"
        );

        $response->assertOk()
            ->assertJsonFragment([
                'message' => 'Projet supprimé avec succès.',
            ]);

        $this->assertDatabaseMissing('projects', [
            'id' => $project->id,
        ]);

        Storage::disk('public')->assertMissing($coverPath);
    }
}
