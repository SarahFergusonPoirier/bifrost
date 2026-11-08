<?php

namespace Tests\Feature;

use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectNarrativeTest extends TestCase
{
    use RefreshDatabase;

    public function test_choices_can_be_reoriented_but_only_between_scenes_of_the_same_work(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $other = $this->postJson($url, ['title' => 'Autre'])->assertCreated()->json('public_id');
        $source = $this->postJson("$url/$work/scenes", ['title' => 'Départ'])->assertCreated()->json('public_id');
        $target = $this->postJson("$url/$work/scenes", ['title' => 'Arrivée'])->assertCreated()->json('public_id');
        $outside = $this->postJson("$url/$other/scenes", ['title' => 'Extérieure'])->assertCreated()->json('public_id');
        $choices = "$url/$work/choices";
        $input = ['source' => $source, 'label' => 'Continuer'];
        $this->putJson($choices, $input + ['target' => $outside])->assertUnprocessable();
        $this->putJson($choices, $input + ['target' => $target])->assertNoContent();
        $this->putJson($choices, $input + ['target' => $source])->assertNoContent();

        $choice = $this->getJson($choices)->assertOk()->assertJsonCount(1)->assertJsonPath('0.target', $source)->json('0.id');
        $this->deleteJson("$url/$other/choices/$choice")->assertNotFound();
        $this->deleteJson("$choices/$choice")->assertNoContent();
        $this->getJson($choices)->assertOk()->assertJsonCount(0);
        $this->assertDatabaseCount('contents', 5);
    }

    public function test_arcs_share_scene_identity_and_progress_within_their_work(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $other = $this->postJson($url, ['title' => 'Autre'])->assertCreated()->json('public_id');
        $scene = $this->postJson("$url/$work/scenes", ['title' => 'Scène'])->assertCreated()->json('public_id');
        $foreign = $this->postJson("$url/$other/scenes", ['title' => 'Autre scène'])->assertCreated()->json('public_id');
        $first = $this->postJson("$url/$work/arcs", ['title' => 'A'])->assertCreated()->json('public_id');
        $second = $this->postJson("$url/$work/arcs", ['title' => 'B'])->assertCreated()->json('public_id');

        $this->putJson("$url/$work/arcs/$first", ['scenes' => [$foreign]])->assertUnprocessable();
        $this->putJson("$url/$work/arcs/$first", ['scenes' => [$scene]])->assertNoContent();
        $this->putJson("$url/$work/arcs/$second", ['scenes' => [$scene]])->assertNoContent();
        $this->patchJson("/api/contents/$scene", ['title' => 'Scène', 'summary' => null, 'work_status_key' => 'completed'])->assertOk();
        $this->getJson("$url/$work/arcs")->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.scenes.0', $scene)->assertJsonPath('1.scenes.0', $scene)
            ->assertJsonPath('0.completed', 1)->assertJsonPath('1.completed', 1);
    }

    public function test_narrative_date_is_read_from_the_scene_field(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $scene = $this->postJson("$url/$work/scenes", ['title' => 'Scène'])->assertCreated()->json('public_id');
        $field = FieldDefinition::where('key', 'narrative-scene.date')->sole();
        $date = ['precision' => 'relative', 'start' => 'Avant le départ', 'calendar' => 'Ère des brumes', 'order' => -2];

        $this->patchJson("/api/contents/$scene", ['title' => 'Scène', 'summary' => null,
            'field_values' => [['field_definition_id' => $field->id, 'value_json' => $date]],
        ])->assertOk();
        $this->getJson($url)->assertOk()->assertJsonPath('0.scenes.0.date', $date)
            ->assertJsonPath('0.scenes.0.public_id', $scene);
    }

    public function test_exports_follow_scene_order_and_only_include_notes_when_requested(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $first = $this->postJson("$url/$work/scenes", ['title' => 'Première'])->assertCreated()->json('public_id');
        $second = $this->postJson("$url/$work/scenes", ['title' => 'Seconde'])->assertCreated()->json('public_id');
        $this->putJson("$url/$work/scenes/order", ['scenes' => [$second, $first]])->assertNoContent();
        $this->patchJson("/api/contents/$first", [
            'title' => 'Première', 'summary' => 'Résumé privé',
            'blocks' => [
                ['body' => 'Texte public.'],
                ['block_type' => 'private_note', 'body' => 'Note privée.'],
            ],
        ])->assertOk();

        $markdown = $this->get("$url/$work/export?format=md")->assertOk()
            ->assertHeader('Content-Disposition', 'attachment; filename="bifrost-oeuvre.md"')
            ->assertDontSee('Résumé privé')->assertDontSee('Note privée.')->getContent();
        $this->assertSame("# Roman\n\n## Seconde\n\n## Première\n\nTexte public.\n", $markdown);

        $this->get("$url/$work/export?format=txt&notes=1")->assertOk()
            ->assertSee('Résumé privé')->assertSee('Note privée.');
        $this->get("/api/projects/{$other->id}/narration/$work/export?format=txt")->assertNotFound();
    }

    public function test_a_scene_has_one_identity_across_order_and_editing_views(): void
    {
        $project = Project::create(['name' => 'Projet']);
        $other = Project::create(['name' => 'Autre']);
        $url = "/api/projects/{$project->id}/narration";
        $work = $this->postJson($url, ['title' => 'Roman'])->assertCreated()->json('public_id');
        $first = $this->postJson("$url/$work/scenes", ['title' => 'Départ'])->assertCreated()->json('public_id');
        $second = $this->postJson("$url/$work/scenes", ['title' => 'Arrivée'])->assertCreated()->json('public_id');
        $this->postJson("/api/projects/{$other->id}/narration/$work/scenes", ['title' => 'Externe'])->assertNotFound();

        $this->putJson("$url/$work/scenes/order", ['scenes' => [$second]])->assertUnprocessable();
        $this->putJson("$url/$work/scenes/order", ['scenes' => [$second, $first]])->assertNoContent();
        $this->patchJson("/api/contents/$second", [
            'title' => 'Retour', 'summary' => 'Retour au port', 'work_status_key' => 'completed',
            'blocks' => [['body' => 'Le navire accosta.']],
        ])->assertOk()->assertJsonPath('blocks.0.body', 'Le navire accosta.');

        $this->getJson($url)->assertOk()->assertJsonPath('0.scenes.0.public_id', $second)
            ->assertJsonPath('0.scenes.0.title', 'Retour')->assertJsonPath('0.scenes.0.work_status_key', 'completed')
            ->assertJsonPath('0.scenes.1.public_id', $first);
        $this->assertDatabaseCount('contents', 3);
        $this->assertDatabaseCount('project_narrative_scenes', 2);
        $this->assertDatabaseCount('content_templates', 1);
        $this->getJson("/api/contents/$second")->assertOk()
            ->assertJsonCount(7, 'template_assignment.template_version.fields')
            ->assertJsonPath('template_assignment.template_version.fields.3.field_definition.options_data.format', 'temporal');
    }
}
