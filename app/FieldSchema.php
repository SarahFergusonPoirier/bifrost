<?php

namespace App;

use App\Models\ContentType;
use App\Models\FieldDefinition;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FieldSchema
{
    public static function rules(string $path = 'fields'): array
    {
        return [
            $path => ['present', 'array', 'list', 'max:200'],
            "$path.*" => ['required', 'array:id,label,section,type,help,required,choices,levels,level_descriptions,scale_display,badge_color,repeatable_level_mode,scale_strategy,calculation,history_view,reference_types,allow_reference_creation'],
            "$path.*.id" => ['nullable', 'integer', 'distinct'],
            "$path.*.label" => ['required', 'string', 'max:255'],
            "$path.*.section" => ['required', 'string', 'max:255'],
            "$path.*.type" => ['required', 'in:text,rich_text,number,boolean,date,choice,reference,json,measurement,coordinates,temporal,references,multiple_choice,scale,keywords,equipment,capabilities,repeatable,bullets,external_link,image'],
            "$path.*.help" => ['nullable', 'string', 'max:10000'],
            "$path.*.required" => ['sometimes', 'boolean'],
            "$path.*.allow_reference_creation" => ['sometimes', 'boolean'],
            "$path.*.reference_types" => ['sometimes', 'array', 'list', 'max:100'],
            "$path.*.reference_types.*" => ['required', 'integer', 'exists:content_types,id'],
            "$path.*.calculation" => ['sometimes', 'nullable', 'in:none,age'],
            "$path.*.history_view" => ['sometimes', 'in:current,history'],
            "$path.*.scale_strategy" => ['sometimes', 'in:preserve'],
            "$path.*.levels" => ['sometimes', 'integer', 'between:2,20'],
            "$path.*.level_descriptions" => ['sometimes', 'array', 'list', 'max:20'],
            "$path.*.level_descriptions.*" => ['nullable', 'string', 'max:255'],
            "$path.*.scale_display" => ['sometimes', 'in:segments,number,both'],
            "$path.*.repeatable_level_mode" => ['sometimes', 'in:text,segments'],
            "$path.*.badge_color" => ['sometimes', 'nullable', 'in:accent,blue,green,amber,red'],
            "$path.*.choices" => ['sometimes', 'array', 'list', 'max:100'],
            "$path.*.choices.*" => ['required', 'string', 'max:255'],
        ];
    }

    public static function definitionAttributes(array $field, string $scope, ?int $projectId, ?int $universeId = null): array
    {
        $structured = ! in_array($field['type'], ['text', 'rich_text', 'number', 'boolean', 'date', 'choice', 'reference', 'json'], true);
        $options = $structured || $field['type'] === 'rich_text' ? ['format' => $field['type']] : [];
        if ($field['type'] === 'scale') {
            $options['levels'] = (int) ($field['levels'] ?? 5);
        }
        if (in_array($field['type'], ['reference', 'references'], true) && ! empty($field['reference_types'])) {
            $ids = array_unique(array_map('intval', $field['reference_types']));
            $available = ContentType::whereKey($ids)->where(fn ($query) => $query
                ->whereIn('scope_type', ['system', 'global'])
                ->orWhere(fn ($local) => $local->where('scope_type', 'project')->where('project_id', $projectId)));
            if ($available->count() !== count($ids)) {
                throw ValidationException::withMessages(['fields' => 'Un type de référence est hors de la portée du modèle.']);
            }
            $options['content_type_ids'] = array_values($ids);
        }

        return [
            'key' => 'custom-'.Str::uuid(), 'label' => $field['label'],
            'value_type' => $structured ? 'json' : ($field['type'] === 'rich_text' ? 'text' : $field['type']),
            'options_data' => $options ?: null, 'scope_type' => $scope, 'project_id' => $projectId, 'universe_id' => $universeId,
        ];
    }

    public static function displayOptions(array $field, FieldDefinition $definition, array $previous = [], ?string $previousSection = null, bool $existing = false): array
    {
        $display = ['section_label' => $field['section']] + $previous;
        $oldLabel = $previous['section_label'] ?? $previousSection;
        if ($oldLabel && $oldLabel !== $field['section']) {
            $display['section_aliases'] = array_values(array_unique([$oldLabel, ...($display['section_aliases'] ?? [])]));
        }
        if (array_key_exists('choices', $field)) {
            $display['choices'] = array_values(array_unique($field['choices']));
        }
        if (($definition->options_data['format'] ?? null) === 'scale') {
            $previousLevels = (int) ($display['scale_levels'] ?? $definition->options_data['levels'] ?? 5);
            $levels = (int) ($field['levels'] ?? $previousLevels);
            if ($existing && $levels !== $previousLevels) {
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
        if (isset($field['calculation'])) {
            if ($field['type'] !== 'number') {
                throw ValidationException::withMessages(['fields' => 'Le calcul exige un champ numérique.']);
            }
            $display['calculation'] = $field['calculation'];
        }
        if (isset($field['history_view'])) {
            $display['history_view'] = $field['history_view'];
        }
        if (isset($field['allow_reference_creation']) && ($definition->value_type === 'reference' || ($definition->options_data['format'] ?? null) === 'references')) {
            $display['allow_reference_creation'] = (bool) $field['allow_reference_creation'];
        }

        return $display;
    }
}
