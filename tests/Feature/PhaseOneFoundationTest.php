<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentFieldValue;
use App\Models\ContentRelation;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use App\Models\Resource;
use App\Models\Universe;
use Database\Seeders\PhaseOneContentTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PhaseOneFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_links_and_missing_references_are_distinct_and_preserve_identity(): void
    {
        $source = $this->content();
        $target = $this->content();
        $relation = $source->outgoingRelations()->create([
            'target_content_id' => $target->id,
            'type_key' => 'illustrates',
            'properties_data' => ['order' => 1],
        ]);
        $missing = $source->externalReferences()->create(['target_public_id' => (string) Str::uuid()]);

        $target->update(['title' => 'Nouveau titre']);
        $this->assertTrue($target->incomingRelations()->first()->is($relation));
        $this->assertTrue($relation->target->is($target));
        $this->assertNull($missing->target);

        $target->delete();
        $this->assertNull($relation->fresh()->target);
        $target->restore();
        $this->assertTrue($relation->fresh()->target->is($target));
    }

    public function test_a_content_cannot_link_to_itself(): void
    {
        $content = $this->content();

        $this->expectException(ValidationException::class);

        ContentRelation::factory()->create([
            'source_content_id' => $content->id,
            'target_content_id' => $content->id,
        ]);
    }

    public function test_variant_requires_a_shared_universe_and_inherits_unmodified_values(): void
    {
        $universe = Universe::create(['name' => 'Univers']);
        $project = Project::create(['name' => 'Projet']);
        $base = $this->content(['scope_type' => 'universe', 'universe_id' => $universe->id, 'summary' => 'Commun']);
        $project->universes()->attach($universe->id, ['usage_type' => 'primary']);
        $variant = $base->variants()->create(['project_id' => $project->id, 'title_override' => 'Titre local']);

        $this->assertSame('Titre local', $variant->resolvedTitle());
        $this->assertSame('Commun', $variant->resolvedSummary());
        $this->assertSame('Original', $base->fresh()->title);

        $this->expectException(ValidationException::class);
        $base->variants()->create(['project_id' => Project::create(['name' => 'Autre'])->id]);
    }

    public function test_a_resource_can_be_reused_by_two_contents(): void
    {
        $resource = Resource::factory()->create();
        $first = $this->content();
        $second = $this->content();
        $first->resources()->attach($resource);
        $second->resources()->attach($resource);
        $first->forceDelete();

        $this->assertTrue($second->resources()->first()->is($resource));
        $this->assertSame(1, $resource->contents()->count());
    }

    public function test_creative_content_types_can_be_seeded_repeatedly_without_model_events(): void
    {
        ContentType::withoutEvents(function (): void {
            $this->seed(PhaseOneContentTypeSeeder::class);
            $this->seed(PhaseOneContentTypeSeeder::class);
        });

        $types = ContentType::whereIn('key', ['oeuvre', 'production', 'document'])->get();
        $this->assertCount(3, $types);
        $this->assertTrue($types->every(fn (ContentType $type): bool => Str::isUuid($type->public_id)));
    }

    public function test_existing_data_survives_the_phase_one_migration(): void
    {
        $migration = require database_path('migrations/2026_11_07_235119_add_phase_one_content_foundations.php');
        $migration->down();

        $project = Project::create(['name' => 'Projet existant']);
        $source = $this->content(['scope_type' => 'project', 'project_id' => $project->id]);
        $target = $this->content();
        $value = $this->referenceValue($source, $target);
        $tables = ['projects', 'content_types', 'contents', 'field_definitions', 'content_field_values'];
        $before = array_map(fn (string $table): array => DB::table($table)->orderBy('id')->get()->toArray(), $tables);

        $migration->up();

        $this->assertEquals($before, array_map(fn (string $table): array => DB::table($table)->orderBy('id')->get()->toArray(), $tables));
        $this->assertTrue($value->fresh()->referenceContent->is($target));
        $relation = $source->outgoingRelations()->create(['target_content_id' => $target->id, 'type_key' => 'related']);
        $this->assertTrue($relation->target->is($target));
    }

    public function test_reference_field_survives_renaming_and_soft_deletion(): void
    {
        $target = $this->content();
        $value = $this->referenceValue($this->content(), $target);

        $target->update(['title' => 'Nouveau titre']);
        $this->assertSame('Nouveau titre', $value->fresh()->referenceContent->title);
        $this->assertSame($target->public_id, $value->fresh()->referenceContent->public_id);

        $target->delete();
        $this->assertNull($value->fresh()->referenceContent);
        $this->assertEquals($target->id, $value->fresh()->reference_content_id);

        $target->restore();
        $this->assertTrue($value->fresh()->referenceContent->is($target));
    }

    public function test_catalog_seeding_rolls_back_prior_inserts_if_a_later_insert_fails(): void
    {
        ContentType::creating(function (ContentType $type): void {
            if ($type->key === 'production') {
                $this->assertDatabaseHas('content_types', ['key' => 'oeuvre']);
                throw new \RuntimeException('Échec simulé');
            }
        });

        try {
            $this->seed(PhaseOneContentTypeSeeder::class);
            $this->fail('Le seeder aurait dû propager l’erreur.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Échec simulé', $exception->getMessage());
        }

        $this->assertDatabaseMissing('content_types', ['key' => 'oeuvre']);
        $this->assertDatabaseMissing('content_types', ['key' => 'production']);
        $this->assertDatabaseMissing('content_types', ['key' => 'document']);
    }

    private function referenceValue(Content $source, Content $target): ContentFieldValue
    {
        $field = FieldDefinition::create(['key' => 'related', 'label' => 'Référence', 'value_type' => 'reference']);

        return $source->fieldValues()->create([
            'field_definition_id' => $field->id,
            'reference_content_id' => $target->id,
        ]);
    }

    private function content(array $attributes = []): Content
    {
        $type = ContentType::firstOrCreate(['key' => 'fiche'], ['name' => 'Fiche']);

        return Content::create($attributes + [
            'content_type_id' => $type->id,
            'title' => 'Original',
            'scope_type' => 'global',
        ]);
    }
}
