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
        $projectRelations = ContentRelation::query()->whereHas('source', $inProject)->whereHas('target', $inProject);
        $universeTypes = $project->universes()->get(['universes.id', 'universes.settings'])
            ->flatMap(fn ($universe): array => (array) ($universe->settings['relation_types'] ?? []))
            ->filter(fn ($type): bool => is_string($type) && preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $type) === 1);
        $relationTypes = (clone $projectRelations)->distinct()->pluck('type_key')
            ->merge($universeTypes)->unique()->sort()->values();
        $relations = $projectRelations
            ->where(fn (Builder $query) => $query->where('source_content_id', $record->id)->orWhere('target_content_id', $record->id))
            ->with(['source:id,public_id,title,project_id,content_type_id', 'source.contentType:id,key', 'target:id,public_id,title,project_id,content_type_id,summary', 'target.contentType:id,key'])
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
                'type_key' => $relation->type_key,
                'forward' => $forward,
                'outgoing_label' => $properties[$forward ? 'forward_label' : 'inverse_label'] ?? null,
                'incoming_label' => $properties[$forward ? 'inverse_label' : 'forward_label'] ?? null,
                'note' => $properties['note'] ?? null,
                'status' => $properties['status'] ?? null,
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

        $eventContentIds = $relations->map(fn (ContentRelation $relation) => $relation->source_content_id === $record->id
            ? $relation->target : $relation->source)
            ->filter(fn ($other): bool => $other->contentType?->key === 'evenement-historique')->pluck('id');
        $datedContentIds = $eventContentIds->push($record->id)->unique()->all();

        $dates = ContentFieldValue::query()->whereIntegerInRaw('content_id', $datedContentIds)
            ->whereHas('fieldDefinition', fn (Builder $query) => $query->whereIn('options_data->format', ['temporal', 'repeatable']))
            ->whereNotNull('value_json')->with(['fieldDefinition:id,label', 'content:id,public_id,title,project_id'])->orderBy('id')->get()
            ->flatMap(fn (ContentFieldValue $field): array => array_map(fn (array $entry): array => [
                'key' => 'field-'.$field->id.($entry['id'] ? ':'.$entry['id'] : ''),
                'public_id' => $field->content_id === $record->id ? null : $field->content->public_id,
                'description' => $entry['date']['timeline_description'] ?? null,
                'title' => $entry['date']['timeline_title'] ?? $entry['label']
                    ?? ($field->content_id === $record->id ? $field->fieldDefinition->label : $field->content->title),
                'date' => array_intersect_key($entry['date'], array_flip(['start', 'end', 'precision', 'calendar', 'order'])),
            ], $field->timelineDates()));

        $linkedPublicIds = $linked->pluck('public_id', 'content_id');
        $events = DB::table('project_timeline_events')->where('project_id', $project->id)->whereNull('deleted_at')
            ->whereIntegerInRaw('content_id', $linked->pluck('content_id')->push($record->id)->unique()->all())
            ->orderBy('id')->get()
            ->map(fn (object $event): array => [
                'key' => 'event-'.$event->id,
                'public_id' => $linkedPublicIds->get($event->content_id),
                'description' => $event->description,
                'importance' => $event->importance,
                'title' => $event->title,
                'date' => ['start' => $event->start, 'end' => $event->end, 'precision' => $event->precision, 'calendar' => $event->calendar],
            ]);

        return response()->json(['relations' => $linked, 'relation_types' => $relationTypes, 'equipment' => $equipment, 'capabilities' => $capabilities, 'timeline' => $dates->concat($events)->values()]);
    }
}
