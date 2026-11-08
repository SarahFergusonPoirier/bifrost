<?php

namespace App\Http\Controllers;

use App\Models\ContentFieldValue;
use App\Models\ContentRelation;
use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FicheLinkedDataController extends Controller
{
    public function show(Project $project, string $content): JsonResponse
    {
        $record = $project->contents()->where('public_id', $content)->firstOrFail();
        $inProject = fn (Builder $query) => $query->where('project_id', $project->id);
        $relations = ContentRelation::query()
            ->where(fn (Builder $query) => $query->where('source_content_id', $record->id)->orWhere('target_content_id', $record->id))
            ->whereHas('source', $inProject)->whereHas('target', $inProject)
            ->with(['source:id,public_id,title,project_id', 'target:id,public_id,title,project_id,content_type_id,summary', 'target.contentType:id,key'])
            ->orderBy('id')->get();
        $linked = $relations->map(function (ContentRelation $relation) use ($record): array {
            $forward = $relation->source_content_id === $record->id;
            $other = $forward ? $relation->target : $relation->source;
            $properties = $relation->properties_data ?? [];

            return [
                'id' => $relation->id,
                'link_id' => $relation->id,
                'content_id' => $other->id,
                'public_id' => $other->public_id,
                'title' => $other->title,
                'label' => $properties[$forward ? 'forward_label' : 'inverse_label'] ?? $relation->type_key,
                'note' => $properties['note'] ?? null,
                'role' => $properties['role'] ?? null,
                'start' => $properties['start'] ?? null,
                'end' => $properties['end'] ?? null,
            ];
        });

        $equipment = $relations->filter(fn (ContentRelation $relation): bool => $relation->source_content_id === $record->id
            && $relation->type_key === 'equipment'
            && $relation->target->contentType?->key === 'objet-artefact')
            ->unique('target_content_id')->map(fn (ContentRelation $relation): array => [
                'id' => $relation->id,
                'link_id' => $relation->id,
                'public_id' => $relation->target->public_id,
                'title' => $relation->target->title,
                'note' => $relation->target->summary,
            ])->values();

        $capabilities = $relations->filter(fn (ContentRelation $relation): bool => $relation->source_content_id === $record->id
            && $relation->type_key === 'capability')
            ->unique('target_content_id')->map(fn (ContentRelation $relation): array => [
                'id' => 'capability-'.$relation->id,
                'link_id' => $relation->id,
                'public_id' => $relation->target->public_id,
                'label' => $relation->target->title,
                'description' => $relation->target->summary,
            ])->values();

        $dates = ContentFieldValue::query()->where('content_id', $record->id)
            ->whereHas('fieldDefinition', fn (Builder $query) => $query->where('options_data->format', 'temporal'))
            ->where('value_json->timeline', true)->with('fieldDefinition:id,label')->get()
            ->map(fn (ContentFieldValue $field): array => [
                'key' => 'field-'.$field->id,
                'title' => $field->value_json['timeline_title'] ?? $field->fieldDefinition->label,
                'date' => array_intersect_key($field->value_json, array_flip(['start', 'end', 'precision', 'calendar'])),
            ]);

        $events = DB::table('project_timeline_events')->where('project_id', $project->id)->whereNull('deleted_at')
            ->whereIntegerInRaw('content_id', $linked->pluck('content_id')->push($record->id)->unique()->all())
            ->orderBy('id')->get()
            ->map(fn (object $event): array => [
                'key' => 'event-'.$event->id,
                'importance' => $event->importance,
                'title' => $event->title,
                'date' => ['start' => $event->start, 'end' => $event->end, 'precision' => $event->precision, 'calendar' => $event->calendar],
            ]);

        return response()->json(['relations' => $linked, 'equipment' => $equipment, 'capabilities' => $capabilities, 'timeline' => $dates->concat($events)->values()]);
    }
}
