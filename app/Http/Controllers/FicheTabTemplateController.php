<?php

namespace App\Http\Controllers;

use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FicheTabTemplateController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $templates = DB::table('fiche_tab_templates')
            ->where(fn ($query) => $query->where('project_id', $project->id)->orWhereNull('project_id'))
            ->orderBy('name')->orderBy('id')->get()->map(fn (object $row): array => [
                'id' => $row->id,
                'name' => $row->name,
                'scope' => $row->project_id === null ? 'global' : 'project',
                'definition' => json_decode($row->definition, true, flags: JSON_THROW_ON_ERROR),
            ]);

        return response()->json($templates);
    }

    public function store(Request $request, Project $project, string $content): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'scope' => ['required', 'in:project,global'],
            'tab' => ['required', 'string', 'max:64'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        $record = $project->contents()->where('public_id', $content)->firstOrFail();
        $layout = DB::table('fiche_layouts')->where('content_id', $record->id)->first();
        abort_if(! $layout || (int) $layout->version !== (int) $input['version'], 409, 'Enregistre la disposition actuelle avant de créer un modèle.');

        $tab = collect(json_decode($layout->tabs, true, flags: JSON_THROW_ON_ERROR))->firstWhere('id', $input['tab']);
        abort_if(! $tab, 404);
        $placements = $tab['placements'] ?? [];
        $globalFields = [];
        if ($input['scope'] === 'global') {
            $ids = collect($placements)->flatMap(fn (array $placement): array => $placement['field_order'] ?? [])->unique()->all();
            $globalFields = FieldDefinition::whereKey($ids)->where('scope_type', 'global')->pluck('id')->all();
        }

        $textSlots = [];
        $placements = array_map(function (array $placement) use (&$textSlots, $globalFields, $input): array {
            $source = $placement['source'];
            if (str_starts_with($source, 'text:')) {
                $textSlots[$source] ??= 'blank:'.count($textSlots);
                $placement['source'] = $textSlots[$source];
            }
            unset($placement['id'], $placement['media_image']);
            if ($input['scope'] === 'global' && ! empty($placement['field_order'])) {
                $ordered = array_values(array_intersect($placement['field_order'], $globalFields));
                if ($ordered === []) {
                    unset($placement['field_order']);
                } else {
                    $placement['field_order'] = $ordered;
                }
            }

            return $placement;
        }, $placements);
        $definition = ['title' => $tab['title'], 'icon' => $tab['icon'], 'placements' => $placements];
        $id = DB::table('fiche_tab_templates')->insertGetId([
            'project_id' => $input['scope'] === 'project' ? $project->id : null,
            'name' => $input['name'],
            'definition' => json_encode($definition, JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['id' => $id, 'name' => $input['name'], 'scope' => $input['scope'], 'definition' => $definition], 201);
    }
}
