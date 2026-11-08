<?php

namespace App;

use App\Models\Content;
use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\Project;
use App\Models\TemplateVersion;
use Illuminate\Support\Facades\DB;

class NarrativeScene
{
    public function append(Project $project, Content $work, string $title): Content
    {
        $type = ContentType::firstOrCreate(
            ['key' => 'scene', 'scope_type' => 'system'],
            ['name' => 'Scène', 'is_system' => true],
        );
        $scene = $project->contents()->create([
            'content_type_id' => $type->id, 'scope_type' => 'project', 'title' => $title,
        ]);
        $version = $this->version($type);
        $scene->templateAssignment()->create([
            'template_id' => $version->template_id, 'template_version_id' => $version->id,
        ]);

        $placements = DB::table('project_narrative_scenes');
        $position = (int) $placements->where('work_id', $work->id)->max('position') + 1;
        $placements->insert(['work_id' => $work->id, 'scene_id' => $scene->id, 'position' => $position]);

        return $scene;
    }

    private function version(ContentType $type): TemplateVersion
    {
        $template = ContentTemplate::firstOrCreate(
            ['name' => 'Scène narrative', 'content_type_id' => $type->id, 'scope_type' => 'global', 'is_system' => true],
            ['is_active' => true],
        );
        $template = ContentTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();
        $published = $template->versions()->reorder()->whereNotNull('published_at')->latest('version_number')->first();
        if ($published) {
            return $published;
        }

        $version = $template->versions()->create([
            'version_number' => (int) $template->versions()->reorder()->max('version_number') + 1,
        ]);

        $fields = [
            ['pov', 'Point de vue', 'reference', null, 'distribution', 'Distribution'],
            ['characters', 'Personnages', 'json', 'references', 'distribution', 'Distribution'],
            ['places', 'Lieux', 'json', 'references', 'distribution', 'Distribution'],
            ['date', 'Date ou période', 'json', 'temporal', 'structure', 'Structure narrative'],
            ['goal', 'Objectif', 'text', null, 'structure', 'Structure narrative'],
            ['conflict', 'Conflit', 'text', null, 'structure', 'Structure narrative'],
            ['outcome', 'Résultat', 'text', null, 'structure', 'Structure narrative'],
        ];

        foreach ($fields as $position => [$key, $label, $valueType, $format, $section, $sectionLabel]) {
            $field = FieldDefinition::firstOrCreate(
                ['scope_type' => 'global', 'key' => 'narrative-scene.'.$key],
                ['label' => $label, 'value_type' => $valueType, 'options_data' => $format ? ['format' => $format] : null],
            );
            $version->fields()->create([
                'field_definition_id' => $field->id, 'position' => $position,
                'section_key' => $section, 'display_options' => ['section_label' => $sectionLabel],
            ]);
        }

        $version->update(['published_at' => now()]);

        return $version;
    }
}
