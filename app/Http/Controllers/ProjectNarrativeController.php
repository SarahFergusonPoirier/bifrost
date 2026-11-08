<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\ContentType;
use App\Models\Project;
use App\NarrativeScene;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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
