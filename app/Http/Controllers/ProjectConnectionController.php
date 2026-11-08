<?php

namespace App\Http\Controllers;

use App\Models\ContentRelation;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectConnectionController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $nodes = $project->contents()->with(['contentType:id,name', 'tags:tags.id,name'])
            ->leftJoin('content_graph_positions', 'content_graph_positions.content_id', '=', 'contents.id')
            ->get(['contents.id', 'contents.public_id', 'contents.title', 'contents.summary', 'contents.content_type_id',
                'contents.work_status_key', 'content_graph_positions.x', 'content_graph_positions.y']);

        $ids = $nodes->modelKeys();
        $edges = ContentRelation::whereIntegerInRaw('source_content_id', $ids)
            ->whereIntegerInRaw('target_content_id', $ids)->orderBy('id')->get();

        return response()->json([
            'nodes' => $nodes,
            'edges' => $edges,
            'folders' => DB::table('project_folders')->where('project_id', $project->id)->orderBy('name')->get(['id', 'parent_id', 'name']),
            'memberships' => DB::table('content_collection_memberships')->whereIntegerInRaw('content_id', $ids)->get(),
            'views' => DB::table('project_graph_views')->where('project_id', $project->id)->orderBy('name')->get()
                ->map(fn (object $view): array => ['id' => $view->id, 'name' => $view->name, 'filters' => json_decode($view->filters, true, flags: JSON_THROW_ON_ERROR)]),
        ]);
    }

    public function saveView(Request $request, Project $project): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'filters' => ['required', 'array:search,type,status,folder,tag,relation,depth,mode,anchor'],
            'filters.search' => ['nullable', 'string', 'max:255'],
            'filters.type' => ['nullable', 'integer', 'min:1'],
            'filters.status' => ['nullable', 'in:draft,in_progress,completed,abandoned'],
            'filters.folder' => ['nullable', 'integer', 'min:1'],
            'filters.tag' => ['nullable', 'integer', 'min:1'],
            'filters.relation' => ['nullable', 'alpha_dash:ascii', 'max:80'],
            'filters.depth' => ['required', 'integer', 'between:0,10'],
            'filters.mode' => ['required', 'in:all,any'],
            'filters.anchor' => ['nullable', 'uuid'],
        ]);

        DB::table('project_graph_views')->upsert([[
            'project_id' => $project->id,
            'name' => $validated['name'],
            'filters' => json_encode($validated['filters'], JSON_THROW_ON_ERROR),
        ]], ['project_id', 'name'], ['filters']);

        return response()->json(null, 204);
    }

    public function deleteView(Project $project, int $view): JsonResponse
    {
        abort_unless(DB::table('project_graph_views')->where('project_id', $project->id)->where('id', $view)->delete(), 404);

        return response()->json(null, 204);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', 'uuid'],
            'target' => ['required', 'uuid', 'different:source'],
            'type_key' => ['required', 'alpha_dash:ascii', 'max:80'],
        ]);

        return DB::transaction(function () use ($project, $validated): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $source = $project->contents()->where('public_id', $validated['source'])->firstOrFail();
            $target = $project->contents()->where('public_id', $validated['target'])->firstOrFail();
            $edge = ContentRelation::firstOrCreate([
                'source_content_id' => $source->id,
                'target_content_id' => $target->id,
                'type_key' => $validated['type_key'],
            ]);

            return response()->json($edge, $edge->wasRecentlyCreated ? 201 : 200);
        }, attempts: 3);
    }

    public function destroy(Project $project, int $relation): JsonResponse
    {
        $scope = fn ($query) => $query->where('project_id', $project->id);
        ContentRelation::whereHas('source', $scope)->whereHas('target', $scope)->findOrFail($relation)->delete();

        return response()->json(null, 204);
    }

    public function position(Request $request, Project $project, string $content): JsonResponse
    {
        $position = $request->validate(['x' => ['required', 'numeric', 'between:0,1'], 'y' => ['required', 'numeric', 'between:0,1']]);
        $record = $project->contents()->where('public_id', $content)->firstOrFail();
        DB::table('content_graph_positions')->upsert([['content_id' => $record->id] + $position], ['content_id'], ['x', 'y']);

        return response()->json(null, 204);
    }
}
