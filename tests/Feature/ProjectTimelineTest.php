<?php

namespace Tests\Feature;

use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectTimelineTest extends TestCase
{
    use RefreshDatabase;

    public function test_projected_entry_updates_and_restores_without_duplication(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $type = ContentType::create(['name' => 'Lieu', 'key' => 'lieu']);
        $content = $project->contents()->create(['title' => 'Ville', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $field = FieldDefinition::create([
            'key' => 'fondation', 'label' => 'Fondation', 'value_type' => 'json', 'options_data' => ['format' => 'temporal'],
        ]);
        $url = '/api/contents/'.$content->public_id;
        $timeline = "/api/projects/{$project->id}/timeline";

        $save = fn (array $date) => $this->patchJson($url, [
            'title' => 'Ville', 'summary' => null,
            'field_values' => [['field_definition_id' => $field->id, 'value_json' => $date]],
        ])->assertOk();

        $save(['precision' => 'relative', 'start' => 'Avant la guerre', 'timeline' => true]);
        $revision = $this->postJson("$url/snapshots", ['label' => 'Première date'])->assertCreated()->json('id');
        $key = $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')->json('data.0.key');

        $save(['precision' => 'relative', 'start' => 'Après la guerre', 'timeline' => true]);
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', 'Après la guerre');
        $this->getJson("/api/projects/{$other->id}/timeline")->assertOk()->assertJsonCount(0, 'data');

        $save(['precision' => 'relative', 'start' => 'Après la guerre']);
        $this->getJson($timeline)->assertOk()->assertJsonCount(0, 'data');
        $this->assertSame('Après la guerre', $content->fieldValues()->sole()->value_json['start']);

        $this->postJson("$url/revisions/$revision/restore")->assertOk();
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', 'Avant la guerre');
    }

    public function test_repeatable_date_keeps_its_timeline_key_when_edited_and_reordered(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $type = ContentType::create(['name' => 'Lieu', 'key' => 'lieu']);
        $content = $project->contents()->create(['title' => 'Ville', 'scope_type' => 'project', 'content_type_id' => $type->id]);
        $field = FieldDefinition::create([
            'key' => 'voyages', 'label' => 'Voyages', 'value_type' => 'json', 'options_data' => ['format' => 'repeatable'],
        ]);
        $timeline = "/api/projects/{$project->id}/timeline";
        $links = "/api/projects/{$project->id}/contents/{$content->public_id}/fiche-links";
        $save = fn (array $entries) => $this->patchJson('/api/contents/'.$content->public_id, [
            'title' => 'Ville', 'summary' => null, 'field_values' => [['field_definition_id' => $field->id, 'value_json' => $entries]],
        ])->assertOk();
        $entry = [
            'id' => '3a83a413-c5c8-422c-8459-032e89bb3bc1', 'label' => 'Voyage',
            'date' => ['start' => 'An 498', 'precision' => 'approximate', 'timeline' => true],
        ];

        $save([$entry, ['label' => 'Ancienne entrée']]);
        $key = $this->getJson($timeline.'?precision=approximate')->assertOk()->assertJsonCount(1, 'data')->json('data.0.key');
        $entry['date']['start'] = 'An 499';
        $save([['label' => 'Ancienne entrée'], $entry]);
        $this->getJson($timeline)->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.key', $key)->assertJsonPath('data.0.date.start', 'An 499');
        $this->getJson($links)->assertOk()->assertJsonPath('timeline.0.date.start', 'An 499');

        unset($entry['date']['timeline']);
        $save([$entry]);
        $this->getJson($timeline)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($links)->assertOk()->assertJsonCount(0, 'timeline');
        $this->assertSame('An 499', $content->fieldValues()->sole()->value_json[0]['date']['start']);
    }

    public function test_conversion_keeps_one_entry_and_one_content_across_retries(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $url = "/api/projects/{$project->id}/timeline/events";
        $event = [
            'title' => 'La traversée', 'description' => 'Départ du port', 'precision' => 'approximate',
            'start' => 'Vers 42', 'end' => null, 'calendar' => 'Calendrier local', 'importance' => 'major',
        ];
        $id = $this->postJson($url, $event)->assertCreated()->json('id');
        $content = $this->postJson("$url/$id/convert")->assertCreated()->assertJsonPath('event_id', $id)->json('public_id');
        $this->postJson("$url/$id/convert")->assertOk()->assertJsonPath('public_id', $content);

        $this->assertDatabaseCount('contents', 1);
        $this->assertDatabaseCount('project_timeline_events', 1);
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.content_public_id', $content)
            ->assertJsonPath('data.0.start', 'Vers 42')->assertJsonPath('data.0.importance', 'major');

        $this->patchJson("/api/contents/$content", ['title' => 'Nouveau titre', 'summary' => 'Départ du port'])->assertOk();
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.content_title', 'Nouveau titre');
        $this->deleteJson("$url/$id")->assertNoContent();
        $this->getJson("/api/contents/$content")->assertOk();
    }

    public function test_lightweight_events_can_be_edited_and_removed_within_their_project(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/timeline/events";
        $event = ['title' => 'Incident', 'description' => null, 'precision' => 'unknown',
            'start' => null, 'end' => null, 'calendar' => null, 'importance' => 'minor'];
        $id = $this->postJson($url, $event)->assertCreated()->json('id');
        $this->putJson("/api/projects/{$other->id}/timeline/events/$id", $event)->assertNotFound();
        $this->putJson("$url/$id", array_replace($event, ['title' => 'Incident majeur']))->assertNoContent();
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.title', 'Incident majeur');
        $this->deleteJson("$url/$id")->assertNoContent();
        $this->getJson($url)->assertOk()->assertJsonCount(0, 'data');
    }
}
