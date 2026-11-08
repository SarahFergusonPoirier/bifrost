<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Project;
use App\Models\Tag;
use App\Models\TemplateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ContentRecoveryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'project_id' => ['sometimes', 'required', 'integer', 'exists:projects,id,deleted_at,NULL'],
            'folder_id' => ['sometimes', 'required', 'integer', 'min:0'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sort' => ['sometimes', 'in:title,recent'],
            'type' => ['sometimes', 'integer', 'min:1'],
            'tag' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'in:draft,in_progress,completed,abandoned'],
        ]);
        $request->validate(['project_id' => ['required_with:folder_id']]);
        $search = $validated['search'] ?? null;

        return response()->json(Content::query()
            ->when(isset($validated['project_id']), fn ($query) => $query->where('project_id', $validated['project_id']))
            ->when(isset($validated['type']), fn ($query) => $query->where('content_type_id', $validated['type']))
            ->when(isset($validated['tag']), fn ($query) => $query->whereHas('tags', fn ($tags) => $tags->whereKey($validated['tag'])))
            ->when(isset($validated['status']), fn ($query) => $query->where('work_status_key', $validated['status']))
            ->when($search !== null, function ($query) use ($search): void {
                $pattern = '%'.$search.'%';
                $query->where(fn ($query) => $query->whereLike('title', $pattern)->orWhereLike('summary', $pattern)
                    ->orWhereHas('blocks', fn ($blocks) => $blocks->whereLike('title', $pattern)->orWhereLike('body', $pattern))
                    ->orWhereHas('fieldValues', fn ($values) => $values->whereLike('value_text', $pattern)));
            })
            ->when(isset($validated['folder_id']), function ($query) use ($validated): void {
                $folder = (int) $validated['folder_id'];
                $placements = DB::table('content_collection_memberships')->select('content_id');
                if ((int) $folder === 0) {
                    $query->whereNotIn('contents.id', $placements);
                } else {
                    $branches = DB::table('project_folders')->where('project_id', $validated['project_id'])->get(['id', 'parent_id'])->groupBy('parent_id');
                    $descendants = [(int) $folder];
                    for ($index = 0; $index < count($descendants); $index++) {
                        foreach ($branches->get($descendants[$index], []) as $child) {
                            $descendants[] = $child->id;
                        }
                    }

                    $query->whereIn('contents.id', $placements->whereIn('folder_id', $descendants));
                }
            })
            ->when(($validated['sort'] ?? 'title') === 'recent', fn ($query) => $query->orderByDesc('updated_at'))
            ->orderBy('title')->orderBy('id')
            ->with('tags:tags.id,name')->addSelect(['id', 'public_id', 'title', 'summary', 'content_type_id', 'scope_type'])
            ->addSelect(['folder_id' => DB::table('content_collection_memberships')->selectRaw('MIN(folder_id)')->whereColumn('content_id', 'contents.id')])
            ->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content_type_id' => ['required', 'integer', 'exists:content_types,id,is_active,1'],
            'project_id' => ['required', 'integer', 'exists:projects,id,deleted_at,NULL'],
            'folder_id' => ['nullable', 'integer'],
            'template_version_id' => ['nullable', 'integer', 'exists:template_versions,id'],
        ]);

        return DB::transaction(function () use ($validated): JsonResponse {
            Project::query()->whereKey($validated['project_id'])->lockForUpdate()->firstOrFail();
            $folder = $validated['folder_id'] ?? null;
            if ($folder !== null && ! DB::table('project_folders')->where('project_id', $validated['project_id'])->where('id', $folder)->exists()) {
                throw ValidationException::withMessages(['folder_id' => 'Ce dossier est introuvable dans le projet.']);
            }

            $content = Content::create(Arr::except($validated, ['folder_id', 'template_version_id']) + ['scope_type' => 'project']);
            if ($folder !== null) {
                DB::table('content_collection_memberships')->insert(['content_id' => $content->id, 'folder_id' => $folder]);
            }

            $version = isset($validated['template_version_id'])
                ? TemplateVersion::findOrFail($validated['template_version_id'])
                : TemplateVersion::query()->whereNotNull('published_at')->whereHas('template', fn ($query) => $query
                    ->where('is_system', true)->where('is_active', true)->where('scope_type', 'global')
                    ->where('content_type_id', $content->content_type_id)
                    ->whereHas('contentType', fn ($type) => $type->where('key', 'personnage')))
                    ->orderByDesc('version_number')->first();

            if ($version) {
                if (! $version->template?->is_active) {
                    throw ValidationException::withMessages(['template_version_id' => 'Ce modèle est indisponible.']);
                }

                $content->templateAssignment()->create([
                    'template_id' => $version->template_id,
                    'template_version_id' => $version->id,
                ]);
            }

            return response()->json($content, 201);
        }, attempts: 3);
    }

    public function trash(Request $request): JsonResponse
    {
        $validated = $request->validate(['project_id' => ['sometimes', 'required', 'integer', 'exists:projects,id,deleted_at,NULL']]);

        return response()->json(Content::onlyTrashed()
            ->when(isset($validated['project_id']), fn ($query) => $query->where('project_id', $validated['project_id']))
            ->orderByDesc('deleted_at')->orderBy('id')->paginate());
    }

    public function destroy(string $content): JsonResponse
    {
        Content::where('public_id', $content)->firstOrFail()->delete();

        return response()->json(null, 204);
    }

    public function recover(string $content): JsonResponse
    {
        $record = Content::onlyTrashed()->where('public_id', $content)->firstOrFail();
        $record->restore();

        return response()->json($record);
    }

    public function update(Request $request, string $content): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['present', 'nullable', 'string'],
            'work_status_key' => ['sometimes', 'in:draft,in_progress,completed,abandoned'],
            'version' => ['sometimes', 'required', 'regex:/^[a-f0-9]{64}$/'],
            'tag_ids' => ['sometimes', 'array', 'list', 'max:100'],
            'tag_ids.*' => ['integer', 'distinct', 'exists:tags,id'],
            'blocks' => ['sometimes', 'array', 'list'],
            'blocks.*' => ['array:public_id,block_type,title,body'],
            'blocks.*.public_id' => ['sometimes', 'required', 'uuid', 'distinct:ignore_case'],
            'blocks.*.block_type' => ['sometimes', 'required', 'string', 'max:255'],
            'blocks.*.title' => ['nullable', 'string', 'max:255'],
            'blocks.*.body' => ['nullable', 'string'],
            'field_values' => ['sometimes', 'array', 'list'],
            'field_values.*' => ['array:field_definition_id,value_text,value_number,value_boolean,value_date,value_json,reference_content_id,value_state'],
            'field_values.*.field_definition_id' => ['required', 'integer', 'distinct', 'exists:field_definitions,id,deleted_at,NULL'],
            'field_values.*.value_text' => ['nullable', 'string'],
            'field_values.*.value_number' => ['nullable', 'numeric', 'between:-99999999999999,99999999999999'],
            'field_values.*.value_boolean' => ['nullable', 'boolean'],
            'field_values.*.value_date' => ['nullable', 'date_format:Y-m-d'],
            'field_values.*.value_json' => ['nullable', 'array'],
            'field_values.*.value_state' => ['nullable', 'in:unknown,not_applicable'],
            'field_values.*.reference_content_id' => ['nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($content, $validated): JsonResponse {
            $record = $this->lockContent($content);
            $before = $this->snapshotData($record, $record->getAttributes());
            abort_if(isset($validated['version']) && $validated['version'] !== $this->version($before), 409, 'Ce contenu a changé depuis son ouverture.');
            $record->update(Arr::only($validated, ['title', 'summary', 'work_status_key']));

            if (array_key_exists('tag_ids', $validated)) {
                $record->tags()->sync($validated['tag_ids']);
            }

            if (array_key_exists('blocks', $validated)) {
                $this->saveBlocks($record, $validated['blocks']);
            }

            if (array_key_exists('field_values', $validated)) {
                $this->saveFields($record, $validated['field_values']);
            }

            if ($before !== $this->snapshotData($record, $record->getAttributes())) {
                $this->storeRevision($record, $before);
            }

            return $this->contentResponse($record);
        }, attempts: 3);
    }

    public function history(string $content): JsonResponse
    {
        $record = Content::where('public_id', $content)->firstOrFail();
        $revisions = DB::table('content_revisions')->where('content_id', $record->id)
            ->orderByDesc('id')->paginate();

        $revisions->through(function (object $revision): object {
            $revision->snapshot = json_decode($revision->snapshot, true, flags: JSON_THROW_ON_ERROR);

            return $revision;
        });

        return response()->json($revisions);
    }

    public function snapshot(Request $request, string $content): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:10000'],
        ]);

        return DB::transaction(function () use ($content, $validated): JsonResponse {
            $record = $this->lockContent($content);
            $id = $this->capture($record, $record->getAttributes(), $validated);

            return response()->json(['id' => $id], 201);
        }, attempts: 3);
    }

    public function restoreRevision(string $content, int $revision): JsonResponse
    {
        return DB::transaction(function () use ($content, $revision): JsonResponse {
            $record = $this->lockContent($content);
            $entry = DB::table('content_revisions')->where('content_id', $record->id)
                ->where('id', $revision)->first();
            abort_if($entry === null, 404);

            $current = $record->getAttributes();
            $snapshot = json_decode($entry->snapshot, true, flags: JSON_THROW_ON_ERROR);
            $this->capture($record, $current);
            $this->applySnapshot($record, $snapshot);
            $this->capture($record, $record->getAttributes());

            return response()->json($record);
        }, attempts: 3);
    }

    public function show(string $content): JsonResponse
    {
        $record = Content::where('public_id', $content)->firstOrFail();

        return $this->contentResponse($record);
    }

    public function deletionImpact(string $content): JsonResponse
    {
        $record = Content::where('public_id', $content)->firstOrFail();

        return response()->json([
            'incoming_relations' => $record->incomingRelations()->count(),
            'reference_fields' => DB::table('content_field_values')->where('reference_content_id', $record->id)->count(),
            'external_references' => DB::table('external_references')->where('target_public_id', $record->public_id)->count(),
        ]);
    }

    public function compare(Request $request, string $content): JsonResponse
    {
        $validated = $request->validate(['from' => ['required', 'integer'], 'to' => ['required', 'integer']]);
        $record = Content::where('public_id', $content)->firstOrFail();
        $revisions = DB::table('content_revisions')->where('content_id', $record->id)
            ->whereIn('id', [$validated['from'], $validated['to']])->get()->keyBy('id');
        $from = $revisions->get($validated['from']);
        $to = $revisions->get($validated['to']);
        abort_if(! $from || ! $to, 404);

        $before = json_decode($from->snapshot, true, flags: JSON_THROW_ON_ERROR);
        $after = json_decode($to->snapshot, true, flags: JSON_THROW_ON_ERROR);
        $changes = [];

        foreach (array_intersect_key($before, $after) as $key => $value) {
            if ($value !== $after[$key]) {
                $changes[$key] = ['before' => $value, 'after' => $after[$key]];
            }
        }

        return response()->json(['changes' => (object) $changes]);
    }

    private function saveBlocks(Content $content, array $blocks): void
    {
        $retained = [];
        foreach ($blocks as $position => $attributes) {
            $publicId = $attributes['public_id'] ?? null;
            $block = $publicId === null
                ? $content->blocks()->make()
                : $content->blocks()->where('public_id', $publicId)->first();

            if ($block === null) {
                throw ValidationException::withMessages(['blocks' => 'Un bloc est introuvable dans ce contenu.']);
            }

            $block->fill([
                'block_type' => $attributes['block_type'] ?? 'text',
                'title' => $attributes['title'] ?? null,
                'body' => $attributes['body'] ?? null,
                'position' => $position,
            ])->save();
            $retained[] = $block->id;
        }

        $content->blocks()->whereNotIn('id', $retained)->delete();
    }

    private function saveFields(Content $content, array $fields): void
    {
        $columns = array_fill_keys([
            'value_text', 'value_number', 'value_boolean', 'value_date', 'value_json', 'reference_content_id', 'value_state',
        ], null);
        foreach ($fields as $field) {
            $value = $content->fieldValues()->firstOrNew(['field_definition_id' => $field['field_definition_id']]);
            $value->fill(array_intersect_key($field, $columns) + $columns);
            if (! $value->exists || $value->isDirty()) {
                $value->save();
            }
        }

        $content->fieldValues()->whereNotIn('field_definition_id', array_column($fields, 'field_definition_id'))->delete();
    }

    private function applySnapshot(Content $content, array $snapshot): void
    {
        $content->update([
            'title' => $snapshot['title'],
            'summary' => $snapshot['summary'],
            'work_status_key' => $snapshot['work_status_key'] ?? $content->work_status_key,
        ]);

        if (array_key_exists('tag_ids', $snapshot)) {
            $content->tags()->sync(Tag::whereKey($snapshot['tag_ids'])->pluck('id')->all());
        }

        // Older revisions only recorded title and summary.
        if (array_key_exists('blocks', $snapshot)) {
            $blocks = $snapshot['blocks'];
            $content->blocks()->whereNotIn('public_id', array_column($blocks, 'public_id'))->delete();

            foreach ($blocks as $block) {
                DB::table('content_blocks')->updateOrInsert(
                    ['content_id' => $content->id, 'public_id' => $block['public_id']],
                    $block + ['deleted_at' => null, 'updated_at' => now()],
                );
            }
        }

        if (array_key_exists('field_values', $snapshot)) {
            $values = $snapshot['field_values'];
            $content->fieldValues()->whereNotIn('field_definition_id', array_column($values, 'field_definition_id'))->delete();

            foreach ($values as $value) {
                // Existing historical references may point to a soft-deleted target.
                DB::table('content_field_values')->updateOrInsert(
                    ['content_id' => $content->id, 'field_definition_id' => $value['field_definition_id']],
                    $value + ['value_state' => null, 'updated_at' => now()],
                );
            }
        }
    }

    private function snapshotData(Content $content, array $attributes): array
    {
        return [
            'title' => $attributes['title'],
            'summary' => $attributes['summary'] ?? null,
            'work_status_key' => $attributes['work_status_key'],
            'tag_ids' => $content->tags()->orderBy('tags.id')->pluck('tags.id')->all(),
            'blocks' => $content->blocks()->reorder()->orderBy('position')->orderBy('id')->get([
                'public_id', 'block_type', 'title', 'body', 'position', 'created_at',
            ])->map(fn ($block): array => $block->getAttributes())->all(),
            'field_values' => $content->fieldValues()->orderBy('field_definition_id')->get([
                'field_definition_id', 'value_text', 'value_number', 'value_boolean', 'value_date',
                'value_json', 'reference_content_id', 'value_state', 'created_at',
            ])->map(function ($value): array {
                $attributes = $value->getAttributes();
                if ($attributes['value_state'] === null) {
                    unset($attributes['value_state']);
                }

                return $attributes;
            })->all(),
        ];
    }

    private function contentResponse(Content $content): JsonResponse
    {
        $content->load('blocks', 'fieldValues', 'tags', 'templateAssignment.templateVersion.fields.fieldDefinition');
        $origin = DB::table('project_idea_conversions')->where('content_id', $content->id)
            ->join('project_ideas', 'project_ideas.id', '=', 'project_idea_conversions.idea_id')
            ->first(['project_ideas.id', 'project_ideas.title', 'project_ideas.archived_at']);
        $content->setAttribute('origin_idea', $origin);

        return response()->json($content)->header(
            'ETag',
            '"'.$this->version($this->snapshotData($content, $content->getAttributes())).'"',
        );
    }

    private function version(array $snapshot): string
    {
        return hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
    }

    private function lockContent(string $publicId): Content
    {
        return Content::where('public_id', $publicId)->lockForUpdate()->firstOrFail();
    }

    private function capture(Content $content, array $attributes, array $metadata = []): int
    {
        return $this->storeRevision($content, $this->snapshotData($content, $attributes), $metadata);
    }

    private function storeRevision(Content $content, array $snapshot, array $metadata = []): int
    {
        return DB::table('content_revisions')->insertGetId([
            'content_id' => $content->id,
            'label' => $metadata['label'] ?? null,
            'note' => $metadata['note'] ?? null,
            'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
