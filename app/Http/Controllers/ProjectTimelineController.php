<?php

namespace App\Http\Controllers;

use App\Models\ContentFieldValue;
use App\Models\ContentType;
use App\Models\Project;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectTimelineController extends Controller
{
    public function index(Request $request, Project $project): JsonResponse
    {
        $filters = $request->validate([
            'precision' => ['sometimes', 'in:exact,approximate,range,relative,unknown'],
        ]);

        $entries = ContentFieldValue::query()
            ->whereHas('content', fn ($query) => $query->where('project_id', $project->id))
            ->whereHas('fieldDefinition', fn ($query) => $query->where('options_data->format', 'temporal'))
            ->where('value_json->timeline', true)
            ->when(isset($filters['precision']), fn ($query) => $query->where('value_json->precision', $filters['precision']))
            ->with(['content:id,public_id,project_id,title', 'fieldDefinition:id,label'])
            ->orderBy('id')
            ->paginate(50)
            ->through(fn (ContentFieldValue $field): array => [
                'key' => $field->content->public_id.':'.$field->field_definition_id,
                'content_public_id' => $field->content->public_id,
                'title' => $field->value_json['timeline_title'] ?? $field->content->title.' · '.$field->fieldDefinition->label,
                'description' => $field->value_json['timeline_description'] ?? null,
                'date' => array_intersect_key($field->value_json, array_flip(['start', 'end', 'calendar', 'precision'])),
            ]);

        return response()->json($entries);
    }

    public function events(Request $request, Project $project): JsonResponse
    {
        $filters = $request->validate(['precision' => ['sometimes', 'in:exact,approximate,range,relative,unknown']]);

        return response()->json($this->eventQuery($project)
            ->when(isset($filters['precision']), fn ($query) => $query->where('project_timeline_events.precision', $filters['precision']))
            ->leftJoin('contents', function ($join): void {
                $join->on('contents.id', '=', 'project_timeline_events.content_id')->whereNull('contents.deleted_at');
            })
            ->select('project_timeline_events.*', 'contents.public_id as content_public_id', 'contents.title as content_title')
            ->orderBy('project_timeline_events.id')->paginate(50));
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $id = DB::table('project_timeline_events')->insertGetId($this->validateEvent($request) + [
            'project_id' => $project->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['id' => $id], 201);
    }

    public function update(Request $request, Project $project, int $event): JsonResponse
    {
        $attributes = $this->validateEvent($request);
        $query = $this->eventQuery($project)->where('id', $event);
        abort_unless($query->exists(), 404);
        $query->update($attributes + ['updated_at' => now()]);

        return response()->json(null, 204);
    }

    public function convert(Project $project, int $event): JsonResponse
    {
        return DB::transaction(function () use ($project, $event): JsonResponse {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $query = $this->eventQuery($project)->where('id', $event);
            $record = $query->lockForUpdate()->first();
            abort_if($record === null, 404);

            if ($record->content_id !== null) {
                $existing = $project->contents()->withTrashed()->findOrFail($record->content_id);

                return response()->json(['public_id' => $existing->public_id, 'event_id' => $event]);
            }

            $type = ContentType::firstOrCreate(
                ['key' => 'evenement-historique', 'scope_type' => 'system'],
                ['name' => 'Événement', 'is_system' => true],
            );
            $content = $project->contents()->create([
                'content_type_id' => $type->id,
                'scope_type' => 'project',
                'title' => $record->title,
                'summary' => $record->description,
            ]);
            $query->update(['content_id' => $content->id, 'updated_at' => now()]);

            return response()->json(['public_id' => $content->public_id, 'event_id' => $event], 201);
        }, attempts: 3);
    }

    public function destroy(Project $project, int $event): JsonResponse
    {
        abort_unless($this->eventQuery($project)->where('id', $event)->update(['deleted_at' => now()]), 404);

        return response()->json(null, 204);
    }

    private function eventQuery(Project $project): Builder
    {
        return DB::table('project_timeline_events')->where('project_timeline_events.project_id', $project->id)->whereNull('project_timeline_events.deleted_at');
    }

    private function validateEvent(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['present', 'nullable', 'string', 'max:10000'],
            'precision' => ['required', 'in:exact,approximate,range,relative,unknown'],
            'start' => ['present', 'nullable', 'required_unless:precision,unknown', 'string', 'max:255'],
            'end' => ['present', 'nullable', 'required_if:precision,range', 'string', 'max:255'],
            'calendar' => ['present', 'nullable', 'string', 'max:255'],
            'importance' => ['required', 'in:major,secondary,minor,unspecified'],
        ]);
    }
}
