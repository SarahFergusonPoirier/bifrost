<?php

namespace App\Http\Controllers;

use App\Models\ContentRelation;
use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
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
            $edge = $this->matchingRelation($source->id, $target->id, $validated['type_key'])->first();
            if ($edge) {
                return response()->json($edge);
            }

            $edge = ContentRelation::create([
                'source_content_id' => $source->id,
                'target_content_id' => $target->id,
                'type_key' => $validated['type_key'],
            ]);

            return response()->json($edge, 201);
        }, attempts: 3);
    }

    public function update(Request $request, Project $project, int $relation): JsonResponse
    {
        $input = $request->validate([
            'type_key' => ['required', 'alpha_dash:ascii', 'max:80'],
            'properties' => ['present', 'array:forward_label,inverse_label,role,start,end,note'],
            'properties.forward_label' => ['nullable', 'string', 'max:255'],
            'properties.inverse_label' => ['nullable', 'string', 'max:255'],
            'properties.role' => ['nullable', 'string', 'max:255'],
            'properties.start' => ['nullable', 'string', 'max:255'],
            'properties.end' => ['nullable', 'string', 'max:255'],
            'properties.note' => ['nullable', 'string', 'max:10000'],
        ]);

        return DB::transaction(function () use ($project, $relation, $input): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $edge = $this->projectRelation($project, $relation);
            $duplicate = $this->matchingRelation($edge->source_content_id, $edge->target_content_id, $input['type_key'])
                ->whereKeyNot($edge->id)->exists();
            abort_if($duplicate, 409, 'Une relation de ce type existe déjà entre ces fiches.');

            $properties = array_filter(array_replace($edge->properties_data ?? [], $input['properties']),
                fn ($value) => $value !== null);
            $edge->update(['type_key' => $input['type_key'], 'properties_data' => $properties]);

            return response()->json($edge);
        }, attempts: 3);
    }

    private function matchingRelation(int $source, int $target, string $type): Builder
    {
        return ContentRelation::where('type_key', $type)
            ->where(function ($query) use ($source, $target, $type): void {
                $query->where(fn ($pair) => $pair->where('source_content_id', $source)->where('target_content_id', $target));
                if (! in_array($type, ['equipment', 'capability', 'arc_scene'], true)) {
                    $query->orWhere(fn ($pair) => $pair->where('source_content_id', $target)->where('target_content_id', $source));
                }
            });
    }

    private function projectRelation(Project $project, int $relation): ContentRelation
    {
        $scope = fn ($query) => $query->where('project_id', $project->id);

        return ContentRelation::whereHas('source', $scope)->whereHas('target', $scope)->findOrFail($relation);
    }

    public function destroy(Project $project, int $relation): JsonResponse
    {
        $this->projectRelation($project, $relation)->delete();

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
