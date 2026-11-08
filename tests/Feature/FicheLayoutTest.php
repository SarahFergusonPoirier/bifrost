<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        $layout['tabs'] = [$custom, ...$layout['tabs']];
        $layout['tabs'][1]['hidden'] = true;
        $this->putJson($url, $layout)->assertOk()->assertJsonPath('version', 1);
        $this->putJson($url, $layout)->assertConflict();
        $this->getJson($url)->assertOk()->assertJsonPath('tabs', $layout['tabs']);

        $this->putJson($url, ['version' => 1, 'tabs' => [$layout['tabs'][1]]])->assertUnprocessable();
        $this->putJson($url, ['version' => 1, 'tabs' => [$custom]])->assertOk();
        $this->assertSame('Un résumé', $content->fresh()->summary);
    }
}
