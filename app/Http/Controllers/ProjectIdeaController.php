<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProjectIdeaController extends Controller
{
    public function index(Request $request, Project $project): JsonResponse
    {
        $filters = $request->validate(['archive' => ['sometimes', 'boolean']]);
        $ideas = $this->ideas($project)
            ->when($filters['archive'] ?? false, fn ($query) => $query->whereNotNull('archived_at'), fn ($query) => $query->whereNull('archived_at'))
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

        return response()->json($ideas);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $input = $request->validate(['title' => ['nullable', 'string', 'max:255'], 'body' => ['required', 'string', 'max:100000']]);
        $id = $this->ideas($project)->insertGetId($input + [
            'project_id' => $project->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function update(Request $request, Project $project, int $idea): JsonResponse
    {
        $input = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'required', 'string', 'max:100000'],
            'column_key' => ['sometimes', 'in:new,develop,retained,abandoned'],
            'archived' => ['sometimes', 'boolean'],
            'folder_ids' => ['sometimes', 'array', 'list', 'max:100'],
            'folder_ids.*' => ['integer', 'distinct', Rule::exists('project_folders', 'id')->where('project_id', $project->id)],
        ]);

        return DB::transaction(function () use ($project, $idea, $input): JsonResponse {
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
            'content_type_id' => ['required', 'integer', 'exists:content_types,id,is_active,1'],
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

            $content = $project->contents()->create(Arr::only($input, ['title', 'content_type_id']) + [
                'scope_type' => 'project', 'work_status_key' => 'draft',
            ]);
            $content->blocks()->create(['body' => $record->body]);
            DB::table('project_idea_conversions')->insert($conversion + ['content_id' => $content->id]);

            return response()->json(['public_id' => $content->public_id], 201);
        }, attempts: 3);
    }

    private function ideas(Project $project): Builder
    {
        return DB::table('project_ideas')->where('project_id', $project->id);
    }
}
