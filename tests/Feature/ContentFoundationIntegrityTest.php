<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentBlock;
use App\Models\ContentType;
use App\Models\Project;
use App\Models\Universe;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use LogicException;
use Tests\TestCase;

class ContentFoundationIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_detaching_a_project_from_a_universe_keeps_both_records(): void
    {
        $project = Project::create(['name' => 'Projet partagé']);
        $universe = Universe::create(['name' => 'Univers partagé']);
        $project->universes()->attach($universe->id);
        $project->universes()->detach($universe->id);

        $this->assertDatabaseHas('projects', ['id' => $project->id]);
        $this->assertDatabaseHas('universes', ['id' => $universe->id]);
        $this->assertDatabaseMissing('project_universe', [
            'project_id' => $project->id,
            'universe_id' => $universe->id,
        ]);
    }

    public function test_project_scoped_content_requires_only_a_project_reference(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        $this->expectException(ValidationException::class);

        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Portée invalide',
            'scope_type' => 'project',
        ]);
    }

    public function test_content_cannot_have_both_project_and_universe_scope_references(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $universe = Universe::create(['name' => 'Univers']);
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        $this->expectException(ValidationException::class);

        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Portée ambiguë',
            'scope_type' => 'project',
            'project_id' => $project->id,
            'universe_id' => $universe->id,
        ]);
    }

    public function test_project_scoped_content_type_requires_only_a_project_reference(): void
    {
        $this->expectException(ValidationException::class);

        ContentType::create([
            'key' => 'local-note',
            'name' => 'Note locale',
            'scope_type' => 'project',
        ]);
    }

    public function test_content_defaults_to_draft_work_status(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Brouillon par défaut',
            'scope_type' => 'global',
        ]);

        $this->assertSame('draft', $content->work_status_key);
        $this->assertDatabaseHas('contents', [
            'id' => $content->id,
            'work_status_key' => 'draft',
        ]);
    }

    public function test_content_accepts_each_supported_work_status(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        foreach (Content::WORK_STATUS_KEYS as $status) {
            $content = Content::create([
                'content_type_id' => $type->id,
                'title' => 'Contenu ' . $status,
                'scope_type' => 'global',
                'work_status_key' => $status,
            ]);

            $this->assertSame($status, $content->work_status_key);
        }
    }

    public function test_content_rejects_unknown_work_status(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        $this->expectException(ValidationException::class);

        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Statut invalide',
            'scope_type' => 'global',
            'work_status_key' => 'published',
        ]);
    }

    public function test_system_content_types_cannot_be_updated_or_deleted(): void
    {
        $type = ContentType::create([
            'key' => 'character',
            'name' => 'Personnage',
            'scope_type' => 'system',
            'is_system' => true,
        ]);

        try {
            $type->update(['name' => 'Nom modifié']);
            $this->fail('Un type système ne devrait pas pouvoir être modifié.');
        } catch (LogicException $exception) {
            $this->assertSame('Les types de contenu système ne peuvent pas être modifiés.', $exception->getMessage());
        }

        $this->expectException(LogicException::class);
        $type->delete();
    }

    public function test_project_cannot_be_hard_deleted_while_content_references_it(): void
    {
        $project = Project::create(['name' => 'Projet utilisé']);
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);

        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note liée',
            'scope_type' => 'project',
            'project_id' => $project->id,
        ]);

        $this->expectException(QueryException::class);
        $project->forceDelete();
    }

    public function test_content_type_cannot_be_hard_deleted_while_content_references_it(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note liée',
            'scope_type' => 'global',
        ]);

        $this->expectException(QueryException::class);
        $type->delete();
    }

    public function test_origin_content_cannot_be_hard_deleted_while_derived_content_references_it(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $origin = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Origine',
            'scope_type' => 'global',
        ]);
        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Copie',
            'scope_type' => 'global',
            'origin_content_id' => $origin->id,
        ]);

        $this->expectException(QueryException::class);
        $origin->forceDelete();
    }

    public function test_hard_deleting_content_cascades_to_its_blocks(): void
    {
        $type = ContentType::create(['key' => 'note', 'name' => 'Note']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Contenu avec bloc',
            'scope_type' => 'global',
        ]);
        $block = ContentBlock::create([
            'content_id' => $content->id,
            'body' => 'Texte de test',
        ]);

        $content->forceDelete();

        $this->assertDatabaseMissing('contents', ['id' => $content->id]);
        $this->assertDatabaseMissing('content_blocks', ['id' => $block->id]);
    }

    public function test_content_cannot_use_a_project_scoped_type_from_another_project(): void
    {
        $firstProject = Project::create(['name' => 'Premier projet']);
        $secondProject = Project::create(['name' => 'Deuxième projet']);
        $type = ContentType::create([
            'key' => 'local-note',
            'name' => 'Note locale',
            'scope_type' => 'project',
            'project_id' => $firstProject->id,
        ]);

        $this->expectException(ValidationException::class);

        Content::create([
            'content_type_id' => $type->id,
            'title' => 'Note dans le mauvais projet',
            'scope_type' => 'project',
            'project_id' => $secondProject->id,
        ]);
    }
}
