<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\ContentRelation;
use App\Models\ContentType;
use App\Models\Project;
use App\NarrativeScene;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectNarrativeController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $works = $project->contents()->whereHas('contentType', fn ($query) => $query->where('key', 'oeuvre'))
            ->orderBy('title')->orderBy('id')->get(['id', 'public_id', 'title', 'summary']);
        $scenes = $project->contents()->join('project_narrative_scenes', 'project_narrative_scenes.scene_id', '=', 'contents.id')
            ->whereIntegerInRaw('work_id', $works->modelKeys())->orderBy('position')->orderBy('contents.id')
            ->with(['fieldValues' => fn ($query) => $query
                ->whereHas('fieldDefinition', fn ($definition) => $definition->where('key', 'narrative-scene.date'))
                ->select(['content_id', 'value_json'])])
            ->get(['contents.id', 'contents.public_id', 'contents.title', 'contents.summary', 'contents.work_status_key', 'work_id'])
            ->groupBy('work_id');

        return response()->json($works->map(fn (Content $work): array => $work->toArray() + [
            'scenes' => $scenes->get($work->id, collect())->map(fn (Content $scene): array => [
                ...$scene->attributesToArray(),
                'date' => $scene->fieldValues->first()?->value_json,
            ])->values(),
        ]));
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $input = $request->validate(['title' => ['required', 'string', 'max:255']]);

        return DB::transaction(function () use ($project, $input): JsonResponse {
            $this->lockProject($project);
            $work = $this->createContent($project, 'oeuvre', 'Œuvre', $input['title']);

            return response()->json($work, 201);
        }, attempts: 3);
    }

    public function storeScene(Request $request, Project $project, string $work, NarrativeScene $scenes): JsonResponse
    {
        $input = $request->validate(['title' => ['required', 'string', 'max:255']]);

        return DB::transaction(function () use ($project, $work, $input, $scenes): JsonResponse {
            $this->lockProject($project);
            $record = $this->work($project, $work);
            $scene = $scenes->append($project, $record, $input['title']);

            return response()->json($scene, 201);
        }, attempts: 3);
    }

    public function reorder(Request $request, Project $project, string $work): JsonResponse
    {
        $input = $request->validate([
            'scenes' => ['required', 'array', 'list'],
            'scenes.*' => ['required', 'uuid', 'distinct:ignore_case'],
        ]);

        return DB::transaction(function () use ($project, $work, $input): JsonResponse {
            $this->lockProject($project);
            $record = $this->work($project, $work);
            $scenes = $project->contents()->join('project_narrative_scenes', 'scene_id', '=', 'contents.id')
                ->where('work_id', $record->id)->pluck('contents.id', 'public_id');

            if (count($input['scenes']) !== $scenes->count() || array_diff($input['scenes'], $scenes->keys()->all()) !== []) {
                throw ValidationException::withMessages(['scenes' => 'L’ordre doit contenir toutes les scènes actives de cette œuvre.']);
            }

            foreach ($input['scenes'] as $position => $publicId) {
                DB::table('project_narrative_scenes')->where('scene_id', $scenes[$publicId])->update(['position' => $position + 1]);
            }

            return response()->json(null, 204);
        }, attempts: 3);
    }

    public function choices(Project $project, string $work): JsonResponse
    {
        $scenes = $this->sceneKeys($project, $this->work($project, $work))->flip();
        $choices = DB::table('narrative_choices')->whereIn('source_id', $scenes->keys())
            ->whereIn('target_id', $scenes->keys())->orderBy('id')->get();

        return response()->json($choices->map(fn (object $choice): array => [
            'id' => $choice->id,
            'label' => $choice->label,
            'source' => $scenes[$choice->source_id],
            'target' => $scenes[$choice->target_id],
        ]));
    }

    public function saveChoice(Request $request, Project $project, string $work): JsonResponse
    {
        $input = $request->validate([
            'source' => ['required', 'uuid'],
            'target' => ['required', 'uuid'],
            'label' => ['required', 'string', 'max:255'],
        ]);

        return DB::transaction(function () use ($project, $work, $input): JsonResponse {
            $this->lockProject($project);
            $scenes = $this->sceneKeys($project, $this->work($project, $work));
            if (! $scenes->has($input['source']) || ! $scenes->has($input['target'])) {
                throw ValidationException::withMessages(['target' => 'Les deux scènes doivent appartenir à cette œuvre.']);
            }

            DB::table('narrative_choices')->upsert([[
                'source_id' => $scenes[$input['source']],
                'target_id' => $scenes[$input['target']],
                'label' => $input['label'],
            ]], ['source_id', 'label'], ['target_id']);

            return response()->json(null, 204);
        }, attempts: 3);
    }

    public function deleteChoice(Project $project, string $work, int $choice): JsonResponse
    {
        $scenes = $this->sceneKeys($project, $this->work($project, $work));
        abort_unless(DB::table('narrative_choices')->whereIn('source_id', $scenes->values())->where('id', $choice)->delete(), 404);

        return response()->json(null, 204);
    }

    private function sceneKeys(Project $project, Content $work): Collection
    {
        return $project->contents()->join('project_narrative_scenes', 'scene_id', '=', 'contents.id')
            ->where('work_id', $work->id)->pluck('contents.id', 'contents.public_id');
    }

    public function arcs(Project $project, string $work): JsonResponse
    {
        $record = $this->work($project, $work);
        $sceneIds = DB::table('project_narrative_scenes')->where('work_id', $record->id)->pluck('scene_id');
        $arcs = $this->workArcs($project, $record)
            ->with(['outgoingRelations' => fn ($query) => $query->where('type_key', 'arc_scene')
                ->whereIn('target_content_id', $sceneIds)->with('target:id,public_id,work_status_key')])
            ->orderBy('title')->get();

        return response()->json($arcs->map(function (Content $arc): array {
            $scenes = $arc->outgoingRelations->pluck('target')->filter();

            return [
                'public_id' => $arc->public_id,
                'title' => $arc->title,
                'summary' => $arc->summary,
                'scenes' => $scenes->pluck('public_id')->values(),
                'completed' => $scenes->where('work_status_key', 'completed')->count(),
            ];
        }));
    }

    public function storeArc(Request $request, Project $project, string $work): JsonResponse
    {
        $input = $request->validate(['title' => ['required', 'string', 'max:255']]);

        return DB::transaction(function () use ($project, $work, $input): JsonResponse {
            $this->lockProject($project);
            $record = $this->work($project, $work);
            $arc = $this->createContent($project, 'arc-narratif', 'Arc narratif', $input['title']);
            $record->outgoingRelations()->create(['target_content_id' => $arc->id, 'type_key' => 'narrative_arc']);

            return response()->json(['public_id' => $arc->public_id], 201);
        }, attempts: 3);
    }

    public function updateArc(Request $request, Project $project, string $work, string $arc): JsonResponse
    {
        $input = $request->validate([
            'scenes' => ['present', 'array', 'list'],
            'scenes.*' => ['required', 'uuid', 'distinct:ignore_case'],
        ]);

        return DB::transaction(function () use ($project, $work, $arc, $input): JsonResponse {
            $this->lockProject($project);
            $record = $this->work($project, $work);
            $entry = $this->workArcs($project, $record)->where('public_id', $arc)->firstOrFail();
            $ids = $project->contents()->join('project_narrative_scenes', 'scene_id', '=', 'contents.id')
                ->where('work_id', $record->id)->whereIn('public_id', $input['scenes'])->pluck('contents.id');

            if ($ids->count() !== count($input['scenes'])) {
                throw ValidationException::withMessages(['scenes' => 'Choisis uniquement des scènes actives de cette œuvre.']);
            }

            $activeIds = $project->contents()->join('project_narrative_scenes', 'scene_id', '=', 'contents.id')
                ->where('work_id', $record->id)->pluck('contents.id');
            $entry->outgoingRelations()->where('type_key', 'arc_scene')
                ->whereIn('target_content_id', $activeIds)->whereNotIn('target_content_id', $ids)->delete();

            foreach ($ids as $id) {
                ContentRelation::firstOrCreate(['source_content_id' => $entry->id, 'target_content_id' => $id, 'type_key' => 'arc_scene']);
            }

            return response()->json(null, 204);
        }, attempts: 3);
    }

    private function workArcs(Project $project, Content $work): HasMany
    {
        return $project->contents()->whereHas('contentType', fn ($query) => $query->where('key', 'arc-narratif'))
            ->whereHas('incomingRelations', fn ($query) => $query->where('source_content_id', $work->id)->where('type_key', 'narrative_arc'));
    }

    public function export(Request $request, Project $project, string $work): Response
    {
        $input = $request->validate([
            'format' => ['required', 'in:txt,md'],
            'notes' => ['sometimes', 'boolean'],
        ]);
        $record = $this->work($project, $work);
        $markdown = $input['format'] === 'md';
        $includeNotes = (bool) ($input['notes'] ?? false);
        $scenes = $project->contents()->join('project_narrative_scenes', 'scene_id', '=', 'contents.id')
            ->where('work_id', $record->id)->orderBy('position')->orderBy('contents.id')
            ->with(['blocks' => fn ($query) => $query->orderBy('id')])->get(['contents.*']);
        $parts = [$this->exportHeading($record->title, 1, $markdown)];

        foreach ($scenes as $scene) {
            $parts[] = $this->exportHeading($scene->title, 2, $markdown);

            if ($includeNotes && filled($scene->summary)) {
                $parts[] = $scene->summary;
            }

            foreach ($scene->blocks as $block) {
                if (! $includeNotes && in_array($block->block_type, ['note', 'private_note'], true)) {
                    continue;
                }

                if (filled($block->title)) {
                    $parts[] = $this->exportHeading($block->title, 3, $markdown);
                }

                if (filled($block->body)) {
                    $parts[] = $block->body;
                }
            }
        }

        return response(implode("\n\n", $parts)."\n", 200, [
            'Content-Type' => ($markdown ? 'text/markdown' : 'text/plain').'; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bifrost-oeuvre.'.$input['format'].'"',
        ]);
    }

    private function exportHeading(string $title, int $level, bool $markdown): string
    {
        $title = str_replace(["\r", "\n"], ' ', $title);

        return $markdown ? str_repeat('#', $level).' '.addcslashes($title, '\\*_#[]<>'.chr(96)) : $title;
    }

    private function work(Project $project, string $publicId): Content
    {
        return $project->contents()->where('public_id', $publicId)
            ->whereHas('contentType', fn ($query) => $query->where('key', 'oeuvre'))->firstOrFail();
    }

    private function createContent(Project $project, string $key, string $name, string $title): Content
    {
        $type = ContentType::firstOrCreate(['key' => $key, 'scope_type' => 'system'], ['name' => $name, 'is_system' => true]);

        return $project->contents()->create(['content_type_id' => $type->id, 'scope_type' => 'project', 'title' => $title]);
    }

    private function lockProject(Project $project): void
    {
        Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
    }
}
