<?php

namespace App\Http\Controllers;

use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectIdeaController extends Controller
{
    public function index(Request $request, Project $project): JsonResponse
    {
        $filters = $request->validate([
            'archive' => ['sometimes', 'boolean'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'column' => ['sometimes', 'nullable', 'alpha_dash:ascii', 'max:32'],
        ]);
        $search = $filters['search'] ?? null;
        $ideas = $this->ideas($project)
            ->when($filters['archive'] ?? false, fn ($query) => $query->whereNotNull('archived_at'), fn ($query) => $query->whereNull('archived_at'))
            ->when($search !== null, fn ($query) => $query->where(fn ($query) => $query
                ->whereLike('title', '%'.$search.'%')->orWhereLike('body', '%'.$search.'%')))
            ->when(isset($filters['column']), fn ($query) => $query->where('column_key', $filters['column']))
            ->orderByDesc('updated_at')->orderByDesc('id')->paginate(50);
        $ids = $ideas->getCollection()->pluck('id');
        $memberships = DB::table('project_idea_collections')->whereIn('idea_id', $ids)->get()->groupBy('idea_id');
        $conversions = DB::table('project_idea_conversions')
            ->join('contents', 'contents.id', '=', 'project_idea_conversions.content_id')
            ->whereIn('idea_id', $ids)->whereNull('contents.deleted_at')
            ->get(['idea_id', 'public_id', 'title'])->groupBy('idea_id');
        $ideas->through(function (object $idea) use ($memberships, $conversions): object {
            $idea->folder_ids = $memberships->get($idea->id, collect())->pluck('folder_id')->all();
            $idea->conversions = $conversions->get($idea->id, collect())->all();

            return $idea;
        });

        return response()->json($ideas->toArray() + ['columns' => $this->columns($project)]);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $input = $request->validate(['title' => ['nullable', 'string', 'max:255'], 'body' => ['required', 'string', 'max:100000']]);

        return DB::transaction(function () use ($project, $input): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $id = $this->ideas($project)->insertGetId($input + [
                'project_id' => $project->id, 'column_key' => $this->columns($project)[0]['key'],
                'created_at' => now(), 'updated_at' => now(),
            ]);

            return response()->json(['id' => $id], 201);
        }, attempts: 3);
    }

    public function update(Request $request, Project $project, int $idea): JsonResponse
    {
        $input = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'required', 'string', 'max:100000'],
            'column_key' => ['sometimes', 'required', 'alpha_dash:ascii', 'max:32'],
            'archived' => ['sometimes', 'boolean'],
            'folder_ids' => ['sometimes', 'array', 'list', 'max:100'],
            'folder_ids.*' => ['integer', 'distinct', Rule::exists('project_folders', 'id')->where('project_id', $project->id)],
        ]);

        return DB::transaction(function () use ($project, $idea, $input): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            if (isset($input['column_key']) && ! in_array($input['column_key'], array_column($this->columns($project), 'key'), true)) {
                throw ValidationException::withMessages(['column_key' => 'Cette colonne est indisponible.']);
            }
            $query = $this->ideas($project)->where('id', $idea);
            abort_if($query->lockForUpdate()->first() === null, 404);
            $changes = Arr::except($input, ['archived', 'folder_ids']);
            if (array_key_exists('archived', $input)) {
                $changes['archived_at'] = $input['archived'] ? now() : null;
            }
            $query->update($changes + ['updated_at' => now()]);
            if (isset($input['folder_ids'])) {
                $memberships = DB::table('project_idea_collections');
                $memberships->where('idea_id', $idea)->delete();
                foreach ($input['folder_ids'] as $folder) {
                    $memberships->insert(['idea_id' => $idea, 'folder_id' => $folder]);
                }
            }

            return response()->json(null, 204);
        }, attempts: 3);
    }

    public function convert(Request $request, Project $project, int $idea): JsonResponse
    {
        $input = $request->validate([
            'request_id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'max:255'],
            'content_type_id' => ['nullable', 'required_without:work', 'prohibits:work', 'integer', 'exists:content_types,id,is_active,1'],
            'work' => ['nullable', 'required_without:content_type_id', 'uuid'],
        ]);

        return DB::transaction(function () use ($project, $idea, $input): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $record = $this->ideas($project)->where('id', $idea)->first();
            abort_if($record === null, 404);
            $conversion = ['idea_id' => $idea, 'request_id' => $input['request_id']];
            $previous = DB::table('project_idea_conversions')->where($conversion)->value('content_id');
            if ($previous !== null) {
                $content = $project->contents()->withTrashed()->findOrFail($previous);

                return response()->json(['public_id' => $content->public_id]);
            }

            $work = isset($input['work']) ? $project->contents()->where('public_id', $input['work'])
                ->whereHas('contentType', fn ($query) => $query->where('key', 'oeuvre'))->firstOrFail() : null;
            $type = $work === null ? $input['content_type_id'] : ContentType::firstOrCreate(
                ['key' => 'scene', 'scope_type' => 'system'], ['name' => 'Scène', 'is_system' => true],
            )->id;
            $content = $project->contents()->create(['title' => $input['title'], 'content_type_id' => $type] + [
                'scope_type' => 'project', 'work_status_key' => 'draft',
            ]);
            if ($work !== null) {
                $placements = DB::table('project_narrative_scenes');
                $position = (int) $placements->where('work_id', $work->id)->max('position') + 1;
                $placements->insert(['work_id' => $work->id, 'scene_id' => $content->id, 'position' => $position]);
            }

            $content->blocks()->create(['body' => $record->body]);
            DB::table('project_idea_conversions')->insert($conversion + ['content_id' => $content->id]);

            return response()->json(['public_id' => $content->public_id], 201);
        }, attempts: 3);
    }

    public function saveColumns(Request $request, Project $project): JsonResponse
    {
        $input = $request->validate([
            'columns' => ['required', 'array', 'list', 'min:1', 'max:20'],
            'columns.*' => ['required', 'array:key,label'],
            'columns.*.key' => ['required', 'alpha_dash:ascii', 'distinct', 'max:32'],
            'columns.*.label' => ['required', 'string', 'distinct:ignore_case', 'max:80'],
        ]);

        return DB::transaction(function () use ($project, $input): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $columns = $input['columns'];
            $this->ideas($project)->whereNotIn('column_key', array_column($columns, 'key'))
                ->update(['column_key' => $columns[0]['key'], 'updated_at' => now()]);
            DB::table('project_idea_boards')->upsert([[
                'project_id' => $project->id, 'columns' => json_encode($columns, JSON_THROW_ON_ERROR),
            ]], ['project_id'], ['columns']);

            return response()->json(null, 204);
        }, attempts: 3);
    }

    private function columns(Project $project): array
    {
        $columns = DB::table('project_idea_boards')->where('project_id', $project->id)->value('columns');

        return $columns === null ? [
            ['key' => 'new', 'label' => 'Nouvelles'],
            ['key' => 'develop', 'label' => 'À développer'],
            ['key' => 'retained', 'label' => 'Retenues'],
            ['key' => 'abandoned', 'label' => 'Abandonnées'],
        ] : json_decode($columns, true, flags: JSON_THROW_ON_ERROR);
    }

    private function ideas(Project $project): Builder
    {
        return DB::table('project_ideas')->where('project_id', $project->id);
    }
}
