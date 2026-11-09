<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\ContentTemplate;
use App\Models\ContentTemplateAssignment;
use App\Models\ContentType;
use App\Models\TemplateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ContentTemplateController extends Controller
{
    public function show(ContentTemplate $template): JsonResponse
    {
        $template->load(['versions' => fn ($query) => $query
            ->whereNotNull('published_at')->with('fields.fieldDefinition')]);

        return response()->json($template);
    }

    public function previewUpgrade(string $content, int $version): JsonResponse
    {
        $record = Content::where('public_id', $content)->firstOrFail();
        $assignment = $record->templateAssignment()->firstOrFail();
        $target = $this->publishedVersion($assignment, $version);

        return response()->json($this->versionChanges($record, $assignment, $target));
    }

    public function applyUpgrade(Request $request, string $content, int $version): JsonResponse
    {
        $validated = $request->validate(['from_version_id' => ['required', 'integer']]);

        return DB::transaction(function () use ($content, $version, $validated): JsonResponse {
            $record = Content::where('public_id', $content)->lockForUpdate()->firstOrFail();
            $assignment = $record->templateAssignment()->firstOrFail();
            $target = $this->publishedVersion($assignment, $version);
            abort_if((int) $assignment->template_version_id !== (int) $validated['from_version_id'], 409, 'La version de la fiche a changé.');
            abort_if((int) $assignment->template_version_id === $target->id, 422, 'Cette version est déjà utilisée.');

            $changes = $this->versionChanges($record, $assignment, $target);
            $record->templateUpdateEvents()->create([
                'template_id' => $assignment->template_id,
                'from_template_version_id' => $assignment->template_version_id,
                'to_template_version_id' => $target->id,
                'change_details' => $changes,
            ]);
            $assignment->update(['template_version_id' => $target->id, 'assigned_at' => now()]);

            return response()->json($changes);
        }, attempts: 3);
    }

    private function publishedVersion(ContentTemplateAssignment $assignment, int $version): TemplateVersion
    {
        return TemplateVersion::where('template_id', $assignment->template_id)
            ->whereNotNull('published_at')->findOrFail($version);
    }

    private function versionChanges(Content $content, ContentTemplateAssignment $assignment, TemplateVersion $target): array
    {
        $fields = fn (TemplateVersion $version) => $version->fields()->with('fieldDefinition:id,label,options_data')->get()
            ->keyBy('field_definition_id')->map(fn ($field): array => [
                'id' => $field->field_definition_id,
                'label' => $field->label_override ?? $field->fieldDefinition?->label,
                'section' => $field->section_key,
                'position' => $field->position,
                'required' => $field->is_required,
                'default' => $field->default_value,
                'help' => $field->help_text,
                'display' => $field->display_options,
                'scale_levels' => ($field->fieldDefinition?->options_data['format'] ?? null) === 'scale'
                    ? (int) ($field->display_options['scale_levels'] ?? $field->fieldDefinition->options_data['levels'] ?? 5)
                    : null,
            ]);
        $from = $fields($assignment->templateVersion);
        $to = $fields($target);
        $changed = $to->intersectByKeys($from)->filter(fn (array $field, int $id): bool => $field !== $from[$id]);
        $scales = $changed->filter(fn (array $field, int $id): bool => $field['scale_levels'] !== null
            && $from[$id]['scale_levels'] !== null && $field['scale_levels'] !== $from[$id]['scale_levels']);
        if ($scales->isNotEmpty()) {
            $values = $content->fieldValues()->whereIntegerInRaw('field_definition_id', $scales->keys()->all())
                ->get(['field_definition_id', 'value_json'])->keyBy('field_definition_id');
            foreach ($scales as $id => $field) {
                $level = $values->get($id)?->value_json['level'] ?? null;
                $changed[$id] = $field + ['scale_change' => [
                    'from' => $from[$id]['scale_levels'], 'to' => $field['scale_levels'], 'preserved_level' => $level,
                ]];
            }
        }

        return [
            'from_version_id' => $assignment->template_version_id,
            'to_version_id' => $target->id,
            'added' => $to->diffKeys($from)->values(),
            'removed' => $from->diffKeys($to)->values(),
            'changed' => $changed->values(),
        ];
    }

    public function storeType(Request $request): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id,deleted_at,NULL'],
        ]);
        $project = $input['project_id'] ?? null;
        $type = ContentType::create($input + [
            'key' => 'custom-'.Str::uuid(),
            'scope_type' => $project === null ? 'global' : 'project',
        ]);

        return response()->json($type, 201);
    }

    public function types()
    {
        return ContentType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'description', 'scope_type', 'project_id', 'is_system']);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['sometimes', 'in:all,global,universe,project'],
            'status' => ['sometimes', 'in:active,inactive,all'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $query = ContentTemplate::query()
            ->with([
                'contentType:id,name',
                'project:id,name',
                'universe:id,name',
            ])
            ->orderBy('name');

        $scope = $validated['scope'] ?? 'all';
        if ($scope !== 'all') {
            $query->where('scope_type', $scope);
        }

        $status = $validated['status'] ?? 'active';
        if ($status !== 'all') {
            $query->where('is_active', $status === 'active');
        }

        $search = trim($validated['search'] ?? '');
        if ($search !== '') {
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        return $query->get();
    }
}
