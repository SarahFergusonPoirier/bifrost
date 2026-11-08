<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class ContentRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_named_snapshot_can_be_restored_without_losing_the_current_version(): void
    {
        $content = $this->content();
        $url = '/api/contents/'.$content->public_id;
        $revision = $this->postJson("$url/snapshots", ['label' => 'Début', 'note' => 'Premier état'])
            ->assertCreated()->json('id');

        $this->patchJson($url, ['title' => 'Nouveau', 'summary' => 'Suite'])->assertOk();
        $this->postJson("$url/revisions/$revision/restore")->assertOk()->assertJsonPath('title', 'Original');

        $this->assertSame('Original', $content->fresh()->title);
        $this->assertNull($content->fresh()->summary);
        $this->getJson("$url/revisions")->assertOk()
            ->assertJsonPath('data.0.snapshot.title', 'Original')
            ->assertJsonPath('data.1.snapshot.title', 'Nouveau')
            ->assertJsonPath('data.3.note', 'Premier état');
    }

    public function test_revision_cannot_be_restored_into_another_content(): void
    {
        $source = $this->content();
        $other = $this->content();
        $revision = $this->postJson("/api/contents/$source->public_id/snapshots", ['label' => 'Début'])
            ->assertCreated()->json('id');

        $this->postJson("/api/contents/$other->public_id/revisions/$revision/restore")->assertNotFound();
        $this->assertDatabaseCount('content_revisions', 1);
    }

    public function test_failed_save_rolls_back_its_revision(): void
    {
        $content = $this->content();
        Content::updating(static function (): void {
            throw new RuntimeException('Échec simulé');
        });

        $this->patchJson("/api/contents/$content->public_id", ['title' => 'Nouveau', 'summary' => null])
            ->assertServerError();

        $this->assertSame('Original', $content->fresh()->title);
        $this->assertDatabaseCount('content_revisions', 0);
    }

    public function test_trash_and_recovery_keep_the_same_identity_and_history(): void
    {
        $content = $this->content();
        $url = '/api/contents/'.$content->public_id;
        $this->postJson("$url/snapshots", ['label' => 'Début'])->assertCreated();
        $this->deleteJson($url)->assertNoContent();
        $this->assertSoftDeleted($content);
        $this->getJson('/api/contents/trash')->assertOk()->assertJsonPath('data.0.public_id', $content->public_id);
        $this->getJson("$url/revisions")->assertNotFound();

        $this->postJson("$url/recover")->assertOk()->assertJsonPath('public_id', $content->public_id);
        $this->assertNotSoftDeleted($content);
        $this->getJson("$url/revisions")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_restore_round_trips_blocks_and_typed_values(): void
    {
        $content = $this->content();
        $url = '/api/contents/'.$content->public_id;
        $block = $content->blocks()->create(['body' => 'Texte initial', 'position' => 2]);
        $field = FieldDefinition::create(['key' => 'options', 'label' => 'Options', 'value_type' => 'json']);
        $value = $content->fieldValues()->create([
            'field_definition_id' => $field->id,
            'value_json' => ['enabled' => false, 'count' => 0],
        ]);
        $revision = $this->postJson("$url/snapshots", ['label' => 'Avant'])->assertCreated()->json('id');

        $block->delete();
        $newBlock = $content->blocks()->create(['body' => 'Nouveau texte', 'position' => 0]);
        $value->update(['value_json' => ['enabled' => true]]);
        $newField = FieldDefinition::create(['key' => 'extra', 'label' => 'Extra', 'value_type' => 'boolean']);
        $content->fieldValues()->create(['field_definition_id' => $newField->id, 'value_boolean' => false]);

        $this->postJson("$url/revisions/$revision/restore")->assertOk();
        $this->assertSame($block->id, $content->blocks()->sole()->id);
        $this->assertSame('Texte initial', $content->blocks()->sole()->body);
        $this->assertSame(2, $content->blocks()->sole()->position);
        $this->assertSame(['enabled' => false, 'count' => 0], $content->fieldValues()->sole()->value_json);

        $previous = $this->getJson("$url/revisions")->assertOk()->json('data.1.id');
        $this->postJson("$url/revisions/$previous/restore")->assertOk();
        $this->assertSame($newBlock->id, $content->blocks()->sole()->id);
        $this->assertSame(['enabled' => true], $value->fresh()->value_json);
        $this->assertFalse($content->fieldValues()->where('field_definition_id', $newField->id)->sole()->value_boolean);
    }

    public function test_legacy_revision_leaves_blocks_and_custom_values_intact(): void
    {
        $content = $this->content();
        $block = $content->blocks()->create(['body' => 'À conserver']);
        $field = FieldDefinition::create(['key' => 'note', 'label' => 'Note', 'value_type' => 'text']);
        $value = $content->fieldValues()->create(['field_definition_id' => $field->id, 'value_text' => 'À conserver']);
        $revision = DB::table('content_revisions')->insertGetId([
            'content_id' => $content->id,
            'snapshot' => json_encode(['title' => 'Ancien titre', 'summary' => null], JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);

        $this->postJson("/api/contents/$content->public_id/revisions/$revision/restore")
            ->assertOk()->assertJsonPath('title', 'Ancien titre');
        $this->assertSame('À conserver', $block->fresh()->body);
        $this->assertSame('À conserver', $value->fresh()->value_text);
    }

    public function test_composite_save_records_history_and_rejects_a_stale_version(): void
    {
        $content = $this->content();
        $url = '/api/contents/'.$content->public_id;
        $field = FieldDefinition::create(['key' => 'active', 'label' => 'Actif', 'value_type' => 'boolean']);
        $version = trim($this->getJson($url)->assertOk()->headers->get('ETag'), '"');
        $this->patchJson($url, [
            'title' => 'Modifié', 'summary' => null, 'version' => $version,
            'blocks' => [['body' => 'Texte']],
            'field_values' => [['field_definition_id' => $field->id, 'value_boolean' => false]],
        ])->assertOk()->assertJsonPath('blocks.0.body', 'Texte')->assertJsonPath('field_values.0.value_boolean', false);

        $this->patchJson($url, ['title' => 'Périmé', 'summary' => null, 'version' => $version])->assertConflict();
        $this->assertDatabaseCount('content_revisions', 1);
        $previous = $this->getJson("$url/revisions")->assertOk()->json('data.0.id');
        $current = $this->postJson("$url/snapshots", ['label' => 'Après'])->assertCreated()->json('id');
        $this->getJson("$url/revisions/compare?from=$previous&to=$current")->assertOk()
            ->assertJsonPath('changes.title.before', 'Original')
            ->assertJsonPath('changes.blocks.after.0.body', 'Texte');
    }

    public function test_invalid_field_rolls_back_the_title_and_blocks(): void
    {
        $content = $this->content();
        $field = FieldDefinition::create(['key' => 'active', 'label' => 'Actif', 'value_type' => 'boolean']);

        $this->patchJson('/api/contents/'.$content->public_id, [
            'title' => 'Modifié', 'summary' => null,
            'blocks' => [['body' => 'Texte']],
            'field_values' => [['field_definition_id' => $field->id, 'value_text' => 'Incompatible']],
        ])->assertUnprocessable();

        $this->assertSame('Original', $content->fresh()->title);
        $this->assertDatabaseCount('content_blocks', 0);
        $this->assertDatabaseCount('content_revisions', 0);
    }

    public function test_temporal_fields_validate_precision_and_keep_fictional_dates(): void
    {
        $content = $this->content();
        $field = FieldDefinition::create([
            'key' => 'date-fictive', 'label' => 'Date', 'value_type' => 'json',
            'options_data' => ['format' => 'temporal'],
        ]);
        $url = '/api/contents/'.$content->public_id;
        $data = ['title' => 'Original', 'summary' => null];
        $date = ['precision' => 'relative', 'calendar' => 'Ère des brumes', 'start' => 'Avant la Grande Guerre'];
        $this->patchJson($url, $data + [
            'field_values' => [['field_definition_id' => $field->id, 'value_json' => $date]],
        ])->assertOk()->assertJsonPath('field_values.0.value_json', $date);

        $this->patchJson($url, $data + [
            'field_values' => [['field_definition_id' => $field->id, 'value_json' => ['precision' => 'invalid']]],
        ])->assertUnprocessable();
        $this->assertSame($date, $content->fieldValues()->sole()->value_json);
    }

    private function content(): Content
    {
        $type = ContentType::firstOrCreate(['key' => 'document'], ['name' => 'Document']);

        return Content::create([
            'content_type_id' => $type->id,
            'title' => 'Original',
            'scope_type' => 'global',
        ]);
    }
}
