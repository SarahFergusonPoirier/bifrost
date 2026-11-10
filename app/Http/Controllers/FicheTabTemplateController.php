<?php

namespace App\Http\Controllers;

use App\Models\FieldDefinition;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FicheTabTemplateController extends Controller
{
    public function index(Request $request, Project $project): JsonResponse
    {
        $kind = $request->validate(['kind' => ['sometimes', 'in:tab,block']])['kind'] ?? 'tab';
        $templates = DB::table('fiche_tab_templates')
            ->where(fn ($query) => $query->where('project_id', $project->id)->orWhereNull('project_id'))
            ->when($kind === 'block', fn ($query) => $query->where('definition->kind', 'block'),
                fn ($query) => $query->whereNull('definition->kind'))
            ->orderBy('name')->orderBy('id')->get()->map(fn (object $row): array => [
                'id' => $row->id,
                'name' => $row->name,
                'scope' => $row->project_id === null ? 'global' : 'project',
                'definition' => array_diff_key(json_decode($row->definition, true, flags: JSON_THROW_ON_ERROR), ['history' => true]),
            ]);

        return response()->json($templates);
    }

    public function store(Request $request, Project $project, string $content): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'scope' => ['required', 'in:project,global'],
            'tab' => ['required', 'string', 'max:64'],
            'template_id' => ['sometimes', 'integer', 'min:1', 'required_with:revision'],
            'revision' => ['required_with:template_id', 'integer', 'min:1'],
            'placement' => ['sometimes', 'uuid'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        $record = $project->contents()->where('public_id', $content)->firstOrFail();
        $layout = DB::table('fiche_layouts')->where('content_id', $record->id)->first();
        abort_if(! $layout || (int) $layout->version !== (int) $input['version'], 409, 'Enregistre la disposition actuelle avant de créer un modèle.');

        $tab = collect(json_decode($layout->tabs, true, flags: JSON_THROW_ON_ERROR))->firstWhere('id', $input['tab']);
        abort_if(! $tab, 404);
        $placements = $tab['placements'] ?? [];
        if (isset($input['placement'])) {
            $placement = collect($placements)->firstWhere('id', $input['placement']);
            abort_if(! $placement, 404);
            $placements = [$placement];
        }
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
            if ($input['scope'] === 'global' && isset($placement['field_order'])) {
                $placement['field_order'] = array_values(array_intersect($placement['field_order'], $globalFields));
            }

            return $placement;
        }, $placements);
        $definition = ['title' => $tab['title'], 'icon' => $tab['icon'], 'placements' => $placements];
        if (isset($input['placement'])) {
            $definition['kind'] = 'block';
        }
        if (isset($input['template_id'])) {
            abort_unless(isset($input['placement']), 422, 'Choisis un bloc à enregistrer.');
            $query = DB::table('fiche_tab_templates')->where('id', $input['template_id'])
                ->where('project_id', $input['scope'] === 'project' ? $project->id : null)
                ->where('definition->kind', 'block');
            $existing = (clone $query)->first();
            abort_unless($existing, 404);
            $previous = json_decode($existing->definition, true, flags: JSON_THROW_ON_ERROR);
            $revision = $previous['revision'] ?? 1;
            abort_if($revision !== (int) $input['revision'], 409, 'Le modèle a changé. Recharge la bibliothèque.');

            $history = $previous['history'] ?? [];
            unset($previous['history']);
            $history[] = ['name' => $existing->name, 'definition' => $previous + ['revision' => $revision]];
            $definition['revision'] = $revision + 1;
            $updated = $query->where('definition', $existing->definition)->update([
                'name' => $input['name'],
                'definition' => json_encode($definition + ['history' => $history], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
            abort_unless($updated, 409, 'Le modèle a changé. Recharge la bibliothèque.');

            return response()->json(['id' => $existing->id, 'name' => $input['name'], 'scope' => $input['scope'], 'definition' => $definition]);
        }

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
