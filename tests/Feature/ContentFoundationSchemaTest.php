<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ContentFoundationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_content_foundation_tables_exist(): void
    {
        $this->assertTrue(Schema::hasTable('universes'));
        $this->assertTrue(Schema::hasTable('project_universe'));
        $this->assertTrue(Schema::hasTable('content_types'));
        $this->assertTrue(Schema::hasTable('contents'));
        $this->assertTrue(Schema::hasTable('content_blocks'));
    }

    public function test_projects_and_universes_can_be_related_many_to_many(): void
    {
        $firstProjectId = DB::table('projects')->insertGetId([
            'name' => 'Premier projet',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $secondProjectId = DB::table('projects')->insertGetId([
            'name' => 'Deuxième projet',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $universeId = DB::table('universes')->insertGetId([
            'public_id' => (string) Str::uuid(),
            'name' => 'Univers partagé',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('project_universe')->insert([
            [
                'project_id' => $firstProjectId,
                'universe_id' => $universeId,
                'usage_type' => 'primary',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'project_id' => $secondProjectId,
                'universe_id' => $universeId,
                'usage_type' => 'supplementary',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->assertDatabaseCount('project_universe', 2);
        $this->assertDatabaseHas('project_universe', [
            'project_id' => $firstProjectId,
            'universe_id' => $universeId,
        ]);
        $this->assertDatabaseHas('project_universe', [
            'project_id' => $secondProjectId,
            'universe_id' => $universeId,
        ]);
    }

    public function test_content_can_have_multiple_ordered_text_blocks(): void
    {
        $projectId = DB::table('projects')->insertGetId([
            'name' => 'Projet de test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $typeId = DB::table('content_types')->insertGetId([
            'public_id' => (string) Str::uuid(),
            'key' => 'character',
            'name' => 'Personnage',
            'scope_type' => 'system',
            'is_system' => true,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $contentId = DB::table('contents')->insertGetId([
            'public_id' => (string) Str::uuid(),
            'content_type_id' => $typeId,
            'title' => 'Élia',
            'work_status_key' => 'draft',
            'scope_type' => 'project',
            'project_id' => $projectId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('content_blocks')->insert([
            [
                'public_id' => (string) Str::uuid(),
                'content_id' => $contentId,
                'block_type' => 'text',
                'title' => 'Apparence',
                'body' => 'Cheveux noirs et yeux gris.',
                'position' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'public_id' => (string) Str::uuid(),
                'content_id' => $contentId,
                'block_type' => 'text',
                'title' => 'Histoire',
                'body' => 'Elle a grandi dans le nord.',
                'position' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->assertDatabaseCount('content_blocks', 2);
        $this->assertDatabaseHas('contents', [
            'id' => $contentId,
            'title' => 'Élia',
        ]);
        $this->assertDatabaseHas('content_blocks', [
            'content_id' => $contentId,
            'title' => 'Histoire',
            'position' => 1,
        ]);
    }

    public function test_project_universe_association_cannot_be_duplicated(): void
    {
        $projectId = DB::table('projects')->insertGetId([
            'name' => 'Projet unique',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $universeId = DB::table('universes')->insertGetId([
            'public_id' => (string) Str::uuid(),
            'name' => 'Univers unique',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $association = [
            'project_id' => $projectId,
            'universe_id' => $universeId,
            'usage_type' => 'primary',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('project_universe')->insert($association);

        $this->expectException(QueryException::class);
        DB::table('project_universe')->insert($association);
    }
}
