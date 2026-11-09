<?php

namespace App\Http\Controllers;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use App\Models\TemplateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ContentTemplateAuthoringController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'content_type_id' => ['required', 'integer', 'exists:content_types,id,is_active,1'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id,deleted_at,NULL'],
            'base_version_id' => ['nullable', 'integer'],
        ]);
        $fields = $this->validateFields($request);

        return DB::transaction(function () use ($input, $fields): JsonResponse {
            $project = $input['project_id'] ?? null;
            $base = isset($input['base_version_id'])
                ? TemplateVersion::whereNotNull('published_at')->findOrFail($input['base_version_id'])
                : null;
            $source = $base?->template;
            if ($base !== null && (! $source || (int) $source->content_type_id !== (int) $input['content_type_id']
                || ! ($source->scope_type === 'global' || ($source->scope_type === 'project' && (int) $source->project_id === (int) $project)))) {
                throw ValidationException::withMessages(['base_version_id' => 'Le modèle source est indisponible dans cette portée.']);
            }

            $template = ContentTemplate::create([
                'name' => $input['name'],
                'description' => $input['description'] ?? null,
                'content_type_id' => $input['content_type_id'],
                'scope_type' => $project === null ? 'global' : 'project',
                'project_id' => $project,
                'base_template_id' => $source?->id,
                'is_active' => true,
            ]);
            $version = $this->publish($template, $fields, $base);

            return response()->json(['id' => $template->id, 'version_id' => $version->id], 201);
        }, attempts: 3);
    }

    public function publishVersion(Request $request, ContentTemplate $template): JsonResponse
    {
        abort_if($template->is_system, 403, 'Ce modèle système est protégé.');
        $input = $request->validate(['from_version_id' => ['required', 'integer']]);
        $fields = $this->validateFields($request);

        return DB::transaction(function () use ($template, $input, $fields): JsonResponse {
            $record = ContentTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();
            $latest = $record->versions()->reorder()->whereNotNull('published_at')->latest('version_number')->firstOrFail();
            abort_if($latest->id !== (int) $input['from_version_id'], 409, 'Une nouvelle version a été publiée. Recharge le modèle.');

            $version = $this->publish($record, $fields, $latest);

            return response()->json(['id' => $version->id, 'version_number' => $version->version_number], 201);
        }, attempts: 3);
    }

    private function validateFields(Request $request): array
    {
        return $request->validate([
            'fields' => ['present', 'array', 'list', 'max:200'],
            'fields.*' => ['required', 'array:id,label,section,type,help,required,choices,levels,level_descriptions,scale_display,badge_color,repeatable_level_mode,scale_strategy,history_view,reference_types,allow_reference_creation'],
            'fields.*.id' => ['nullable', 'integer', 'distinct'],
            'fields.*.label' => ['required', 'string', 'max:255'],
            'fields.*.section' => ['required', 'string', 'max:255'],
            'fields.*.type' => ['required', 'in:text,number,boolean,date,choice,reference,json,measurement,coordinates,temporal,references,multiple_choice,scale,keywords,equipment,capabilities,repeatable,bullets,external_link'],
            'fields.*.help' => ['nullable', 'string', 'max:10000'],
            'fields.*.required' => ['sometimes', 'boolean'],
            'fields.*.allow_reference_creation' => ['sometimes', 'boolean'],
            'fields.*.reference_types' => ['sometimes', 'array', 'list', 'max:100'],
            'fields.*.reference_types.*' => ['required', 'integer', 'exists:content_types,id'],
            'fields.*.history_view' => ['sometimes', 'in:current,history'],
            'fields.*.scale_strategy' => ['sometimes', 'in:preserve'],
            'fields.*.levels' => ['sometimes', 'integer', 'between:2,20'],
            'fields.*.level_descriptions' => ['sometimes', 'array', 'list', 'max:20'],
            'fields.*.level_descriptions.*' => ['nullable', 'string', 'max:255'],
            'fields.*.scale_display' => ['sometimes', 'in:segments,number,both'],
            'fields.*.repeatable_level_mode' => ['sometimes', 'in:text,segments'],
            'fields.*.badge_color' => ['sometimes', 'nullable', 'in:accent,blue,green,amber,red'],
            'fields.*.choices' => ['sometimes', 'array', 'list', 'max:100'],
            'fields.*.choices.*' => ['required', 'string', 'max:255'],
        ])['fields'];
    }

    private function publish(ContentTemplate $template, array $fields, ?TemplateVersion $base): TemplateVersion
    {
        $knownFields = $base?->fields()->with('fieldDefinition')->get()->keyBy('field_definition_id') ?? collect();
        $version = $template->versions()->create([
            'version_number' => (int) $template->versions()->reorder()->max('version_number') + 1,
        ]);

        foreach ($fields as $position => $field) {
            $original = $knownFields->get($field['id'] ?? null);
            if (isset($field['id']) && ! $original?->fieldDefinition) {
                throw ValidationException::withMessages(['fields' => 'Un champ ne fait pas partie de la version source.']);
            }
            $structured = in_array($field['type'], ['measurement', 'coordinates', 'temporal', 'references', 'multiple_choice', 'scale', 'keywords', 'equipment', 'capabilities', 'repeatable', 'bullets', 'external_link'], true);
            $options = $structured ? ['format' => $field['type']] : [];
            if ($field['type'] === 'scale') {
                $options['levels'] = (int) ($field['levels'] ?? 5);
            }
            if (in_array($field['type'], ['reference', 'references'], true) && ! empty($field['reference_types'])) {
                $ids = array_unique(array_map('intval', $field['reference_types']));
                $available = ContentType::whereKey($ids)->where(fn ($query) => $query
                    ->whereIn('scope_type', ['system', 'global'])
                    ->orWhere(fn ($local) => $local->where('scope_type', 'project')->where('project_id', $template->project_id)));
                if ($available->count() !== count($ids)) {
                    throw ValidationException::withMessages(['fields' => 'Un type de référence est hors de la portée du modèle.']);
                }
                $options['content_type_ids'] = array_values($ids);
            }
            $definition = $original?->fieldDefinition ?? FieldDefinition::create([
                'key' => 'custom-'.Str::uuid(),
                'label' => $field['label'],
                'value_type' => $structured ? 'json' : $field['type'],
                'options_data' => $options ?: null,
                'scope_type' => $template->scope_type,
                'project_id' => $template->project_id,
                'universe_id' => $template->universe_id,
            ]);
            $display = ['section_label' => $field['section']] + ($original?->display_options ?? []);
            if (array_key_exists('choices', $field)) {
                $display['choices'] = array_values(array_unique($field['choices']));
            }

            if (($definition->options_data['format'] ?? null) === 'scale') {
                $previousLevels = (int) ($display['scale_levels'] ?? $definition->options_data['levels'] ?? 5);
                $levels = (int) ($field['levels'] ?? $previousLevels);
                if ($original && $levels !== $previousLevels) {
                    if (($field['scale_strategy'] ?? null) !== 'preserve') {
                        throw ValidationException::withMessages(['fields' => 'Confirme la conservation des valeurs avant de modifier le nombre de niveaux.']);
                    }
                    $display['scale_levels'] = $levels;
                }
                if (array_key_exists('level_descriptions', $field)) {
                    $display['level_descriptions'] = array_slice($field['level_descriptions'], 0, $levels);
                }
                if (isset($field['scale_display'])) {
                    $display['scale_display'] = $field['scale_display'];
                }
            }

            if ($definition->value_type === 'choice' && array_key_exists('badge_color', $field)) {
                $display['badge_color'] = $field['badge_color'];
            }

            if (($definition->options_data['format'] ?? null) === 'repeatable' && isset($field['repeatable_level_mode'])) {
                $display['repeatable_level_mode'] = $field['repeatable_level_mode'];
            }

            if (isset($field['history_view'])) {
                $display['history_view'] = $field['history_view'];
            }

            if (isset($field['allow_reference_creation']) && ($definition->value_type === 'reference'
                || ($definition->options_data['format'] ?? null) === 'references')) {
                $display['allow_reference_creation'] = (bool) $field['allow_reference_creation'];
            }

            $version->fields()->create([
                'field_definition_id' => $definition->id,
                'label_override' => $field['label'],
                'section_key' => Str::slug($field['section']) ?: 'general',
                'display_options' => $display,
                'position' => $position,
                'help_text' => $field['help'] ?? null,
                'is_required' => $field['required'] ?? false,
                'default_value' => $original?->default_value,
            ]);
        }

        $version->update(['published_at' => now()]);

        return $version;
    }
}
