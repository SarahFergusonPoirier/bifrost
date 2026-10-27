<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentBlock;
use App\Models\ContentType;
use App\Models\Project;
use App\Models\Universe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContentFoundationModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_and_universe_models_support_many_to_many_relationships(): void
    {
        $project = Project::create(['name' => 'Projet partage']);
        $universe = Universe::create(['name' => 'Univers partage']);
        $project->universes()->attach($universe->id, ['usage_type' => 'primary']);
        $this->assertTrue($project->universes->contains('id', $universe->id));
        $this->assertTrue($universe->projects->contains('id', $project->id));
    }

    public function test_content_relationships_and_ordered_blocks_work(): void
    {
        $project = Project::create(['name' => 'Projet test']);
        $universe = Universe::create(['name' => 'Univers test']);
        $type = ContentType::create(['key' => 'character', 'name' => 'Personnage']);
        $content = Content::create([
            'content_type_id' => $type->id,
            'title' => 'Elia',
            'project_id' => $project->id,
            'universe_id' => $universe->id,
        ]);
        $later = ContentBlock::create(['content_id' => $content->id, 'title' => 'Histoire', 'position' => 1]);
        $first = ContentBlock::create(['content_id' => $content->id, 'title' => 'Apparence', 'position' => 0]);
        $this->assertSame($type->id, $content->contentType->id);
        $this->assertSame($project->id, $content->project->id);
        $this->assertSame($universe->id, $content->universe->id);
        $this->assertSame([$first->id, $later->id], $content->fresh()->blocks->pluck('id')->all());
    }

    public function test_content_can_reference_its_origin(): void
    {
        $type = ContentType::create(['key' => 'character', 'name' => 'Personnage']);
        $original = Content::create(['content_type_id' => $type->id, 'title' => 'Original']);
        $derived = Content::create(['content_type_id' => $type->id, 'title' => 'Derived', 'origin_content_id' => $original->id]);
        $this->assertSame($original->id, $derived->originContent->id);
        $this->assertTrue($original->derivedContents->contains('id', $derived->id));
    }
}
