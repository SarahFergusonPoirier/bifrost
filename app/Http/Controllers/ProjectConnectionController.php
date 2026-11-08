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
        $nodes = $project->contents()->with('contentType:id,name')
            ->leftJoin('content_graph_positions', 'content_graph_positions.content_id', '=', 'contents.id')
            ->get(['contents.id', 'contents.public_id', 'contents.title', 'contents.summary', 'contents.content_type_id',
                'contents.work_status_key', 'content_graph_positions.x', 'content_graph_positions.y']);

        $ids = $nodes->modelKeys();
        $edges = ContentRelation::whereIntegerInRaw('source_content_id', $ids)
            ->whereIntegerInRaw('target_content_id', $ids)->orderBy('id')->get();

        return response()->json(['nodes' => $nodes, 'edges' => $edges]);
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
