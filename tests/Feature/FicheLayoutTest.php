<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentRelation;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FicheLayoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_character_defaults_and_custom_tabs_persist_without_changing_content(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::firstOrCreate(['key' => 'personnage'], ['name' => 'Personnage']);
        $content = Content::create([
            'title' => 'Élia',
            'summary' => 'Un résumé',
            'content_type_id' => $type->id,
            'scope_type' => 'project',
            'project_id' => $project->id,
        ]);

        $url = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($url)->assertOk()->assertJsonPath('version', 0)->json();
        $this->assertSame(['overview', 'details', 'relations', 'timeline'], array_column($layout['tabs'], 'id'));
        $this->getJson("/api/projects/{$other->id}/contents/{$content->public_id}/fiche-layout")->assertNotFound();

        $custom = ['id' => 'notes', 'title' => 'Notes', 'icon' => 'narration', 'hidden' => false];
        $custom['placements'] = [[
            'id' => 'bf3c7b23-6268-4185-9d52-ec8428478fb7',
            'source' => 'summary',
            'width' => 8,
            'height' => 3,
            'hidden' => false,
            'collapsed' => true,
        ]];
        $layout['tabs'] = [$custom, ...$layout['tabs']];
        $invalid = $layout;
        $invalid['tabs'][0]['placements'][0]['width'] = 13;
        $this->putJson($url, $invalid)->assertUnprocessable();
        $layout['tabs'][1]['hidden'] = true;
        $this->putJson($url, $layout)->assertOk()->assertJsonPath('version', 1);
        $this->putJson($url, $layout)->assertConflict();
        $this->getJson($url)->assertOk()->assertJsonPath('tabs', $layout['tabs']);

        $this->putJson($url, ['version' => 1, 'tabs' => [$layout['tabs'][1]]])->assertUnprocessable();
        $this->putJson($url, ['version' => 1, 'tabs' => [$custom]])->assertOk();
        $this->assertSame('Un résumé', $content->fresh()->summary);
        $history = $this->getJson("$url/revisions")->assertOk()->assertJsonPath('data.0.version', 1)
            ->assertJsonPath('data.1.version', 0)->json('data.0.tabs');
        $this->putJson($url, ['version' => 2, 'tabs' => $history])->assertOk()
            ->assertJsonPath('version', 3)->assertJsonPath('tabs', $layout['tabs']);
        $this->assertSame('Un résumé', $content->fresh()->summary);
    }

    public function test_linked_tabs_use_directional_labels_and_project_timeline_sources(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::firstOrCreate(['key' => 'personnage'], ['name' => 'Personnage']);
        $make = fn (Project $owner, string $title) => Content::create([
            'title' => $title,
            'content_type_id' => $type->id,
            'scope_type' => 'project',
            'project_id' => $owner->id,
        ]);
        $source = $make($project, 'Mentor');
        $target = $make($project, 'Élève');
        $foreign = $make($other, 'Externe');

        foreach ([$target, $foreign] as $linked) {
            ContentRelation::create([
                'source_content_id' => $source->id,
                'target_content_id' => $linked->id,
                'type_key' => 'mentor',
                'properties_data' => ['forward_label' => 'Élève', 'inverse_label' => 'Mentor'],
            ]);
        }

        DB::table('project_timeline_events')->insert([
            'project_id' => $project->id,
            'content_id' => $target->id,
            'title' => 'Rencontre',
            'precision' => 'approximate',
            'start' => '2010',
        ]);

        $url = "/api/projects/{$project->id}/contents";
        $this->getJson("$url/{$source->public_id}/fiche-links")->assertOk()
            ->assertJsonCount(1, 'relations')->assertJsonPath('relations.0.label', 'Élève')
            ->assertJsonPath('timeline.0.title', 'Rencontre')->assertJsonPath('timeline.0.date.precision', 'approximate');
        $this->getJson("$url/{$target->public_id}/fiche-links")->assertOk()
            ->assertJsonPath('relations.0.label', 'Mentor');
    }

    public function test_text_copy_is_independent_and_committed_with_its_placement(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::firstOrCreate(['key' => 'personnage'], ['name' => 'Personnage']);
        $content = Content::create([
            'title' => 'Élia', 'summary' => 'Résumé original', 'content_type_id' => $type->id,
            'scope_type' => 'project', 'project_id' => $project->id,
        ]);
        $url = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-layout";
        $layout = $this->getJson($url)->assertOk()->json();
        $id = '3a83a413-c5c8-422c-8459-032e89bb3bc1';
        $layout['copies'] = [['id' => $id, 'source' => 'summary']];
        $this->putJson($url, $layout)->assertUnprocessable();
        $this->assertSame(0, $content->blocks()->count());

        $layout['tabs'][0]['placements'] = [[
            'id' => '53cbde0a-d5df-4d20-9611-2af436081194',
            'source' => 'text:'.$id,
            'width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false,
        ]];
        $this->putJson($url, $layout)->assertOk()->assertJsonPath('tabs.0.placements.0.source', 'text:'.$id);
        $this->getJson("$url/blocks/$id/impact")->assertOk()
            ->assertJsonCount(1, 'placements')->assertJsonPath('placements.0.tab', 'overview');

        $content->update(['summary' => 'Nouveau résumé']);
        $this->assertSame('Résumé original', $content->blocks()->sole()->body);

        $layout = $this->getJson($url)->assertOk()->json();
        $blank = '6911f23b-1a4a-4e65-94b8-2a4ab7dbcb7e';
        $layout['copies'] = [['id' => $blank, 'source' => 'blank']];
        $layout['tabs'][0]['placements'][0]['source'] = 'text:'.$blank;
        $this->putJson($url, $layout)->assertUnprocessable()->assertJsonValidationErrors('copies.0.title');
        $layout['copies'][0] += ['title' => 'Biographie', 'body' => 'Début de son histoire.'];
        $this->putJson($url, $layout)->assertOk();
        $this->assertDatabaseHas('content_blocks', ['public_id' => $blank, 'title' => 'Biographie', 'body' => 'Début de son histoire.']);
        $this->assertDatabaseHas('content_blocks', ['public_id' => $id, 'body' => 'Résumé original']);
    }

    public function test_tab_templates_are_scoped_and_never_include_source_text(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::firstOrCreate(['key' => 'personnage'], ['name' => 'Personnage']);
        $content = Content::create([
            'title' => 'Élia', 'summary' => 'Texte privé', 'content_type_id' => $type->id,
            'scope_type' => 'project', 'project_id' => $project->id,
        ]);
        $base = "/api/projects/{$project->id}/contents/{$content->public_id}";
        $layout = $this->getJson("$base/fiche-layout")->assertOk()->json();
        $placement = ['width' => 6, 'height' => 2, 'hidden' => false, 'collapsed' => false];
        $layout['tabs'][0]['placements'] = [
            $placement + ['id' => 'bf3c7b23-6268-4185-9d52-ec8428478fb7', 'source' => 'summary'],
            $placement + ['id' => '53cbde0a-d5df-4d20-9611-2af436081194', 'source' => 'text:3a83a413-c5c8-422c-8459-032e89bb3bc1'],
        ];
        $this->putJson("$base/fiche-layout", $layout)->assertOk();

        $definition = ['name' => 'Aperçu', 'tab' => 'overview', 'version' => 1];
        $this->postJson("$base/fiche-tab-templates", $definition + ['scope' => 'project'])
            ->assertCreated()->assertJsonCount(2, 'definition.placements')
            ->assertJsonPath('definition.placements.0.source', 'summary')
            ->assertJsonPath('definition.placements.1.source', 'blank:0')
            ->assertJsonMissingPath('definition.placements.0.id')->assertDontSee('Texte privé');
        $otherLibrary = "/api/projects/{$other->id}/fiche-tab-templates";
        $this->getJson($otherLibrary)->assertOk()->assertJsonCount(0);
        $this->postJson("$base/fiche-tab-templates", $definition + ['scope' => 'global'])->assertCreated();
        $this->getJson($otherLibrary)->assertOk()->assertJsonCount(1)->assertJsonPath('0.scope', 'global');

        $this->postJson("$base/fiche-tab-templates", $definition + [
            'scope' => 'global', 'placement' => $layout['tabs'][0]['placements'][1]['id'],
        ])->assertCreated()->assertJsonPath('definition.kind', 'block')
            ->assertJsonCount(1, 'definition.placements')
            ->assertJsonPath('definition.placements.0.source', 'blank:0');

        $this->getJson($otherLibrary)->assertOk()->assertJsonCount(1);
        $this->getJson($otherLibrary.'?kind=block')->assertOk()->assertJsonCount(1)
            ->assertJsonPath('0.definition.kind', 'block');

        $blockId = $this->getJson($otherLibrary.'?kind=block')->json('0.id');
        $update = array_replace($definition, [
            'name' => 'Résumé', 'scope' => 'global', 'placement' => $layout['tabs'][0]['placements'][0]['id'],
            'template_id' => $blockId, 'revision' => 1,
        ]);
        $this->postJson("$base/fiche-tab-templates", $update)->assertOk()
            ->assertJsonPath('definition.revision', 2)->assertJsonPath('definition.placements.0.source', 'summary');
        $this->postJson("$base/fiche-tab-templates", $update)->assertConflict();
        $this->getJson($otherLibrary.'?kind=block')->assertOk()->assertJsonCount(1)
            ->assertJsonMissingPath('0.definition.history');
    }

    public function test_equipment_reads_canonical_objects_from_outgoing_equipment_links(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $characterType = ContentType::firstOrCreate(['key' => 'personnage'], ['name' => 'Personnage']);
        $objectType = ContentType::firstOrCreate(['key' => 'objet-artefact'], ['name' => 'Objet']);
        $make = fn (ContentType $type, string $title) => Content::create([
            'title' => $title, 'content_type_id' => $type->id, 'scope_type' => 'project', 'project_id' => $project->id,
        ]);
        $character = $make($characterType, 'Élia');
        $object = $make($objectType, 'Épée');
        $unrelated = $make($objectType, 'Pendentif');
        foreach ([[$object, 'equipment'], [$unrelated, 'mention']] as [$target, $type]) {
            ContentRelation::create(['source_content_id' => $character->id, 'target_content_id' => $target->id, 'type_key' => $type]);
        }
        ContentRelation::create([
            'source_content_id' => $character->id, 'target_content_id' => $unrelated->id, 'type_key' => 'capability',
        ]);
        $unrelated->update(['title' => 'Protection', 'summary' => 'Bloque les sorts']);
        $object->update(['title' => 'Épée de voyage', 'summary' => 'Lame courte']);
        $url = "/api/projects/{$project->id}/contents";
        $this->getJson("$url/{$character->public_id}/fiche-links")->assertOk()->assertJsonCount(1, 'equipment')
            ->assertJsonPath('equipment.0.title', 'Épée de voyage')->assertJsonPath('equipment.0.note', 'Lame courte')
            ->assertJsonPath('capabilities.0.label', 'Protection')->assertJsonPath('capabilities.0.description', 'Bloque les sorts');
        $this->getJson("$url/{$object->public_id}/fiche-links")->assertOk()->assertJsonCount(0, 'equipment');
    }

    public function test_timeline_includes_temporal_fields_from_related_event_fiches(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $characterType = ContentType::create(['key' => 'personnage', 'name' => 'Personnage']);
        $eventType = ContentType::create(['key' => 'evenement-historique', 'name' => 'Événement']);
        $character = $project->contents()->create(['title' => 'Élia', 'content_type_id' => $characterType->id, 'scope_type' => 'project']);
        $event = $project->contents()->create(['title' => 'Rencontre', 'content_type_id' => $eventType->id, 'scope_type' => 'project']);
        $field = FieldDefinition::create([
            'key' => 'date-event', 'label' => 'Date', 'value_type' => 'json', 'options_data' => ['format' => 'temporal'],
        ]);
        $event->fieldValues()->create([
            'field_definition_id' => $field->id, 'value_json' => ['start' => '2010', 'timeline' => true],
        ]);
        ContentRelation::create(['source_content_id' => $event->id, 'target_content_id' => $character->id, 'type_key' => 'participant']);
        $this->getJson("/api/projects/{$project->id}/contents/{$character->public_id}/fiche-links")->assertOk()
            ->assertJsonCount(1, 'timeline')->assertJsonPath('timeline.0.title', 'Rencontre')->assertJsonPath('timeline.0.date.start', '2010')
            ->assertJsonPath('timeline.0.public_id', $event->public_id);
    }
}
