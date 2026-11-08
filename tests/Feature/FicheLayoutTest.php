<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentRelation;
use App\Models\ContentType;
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
}
