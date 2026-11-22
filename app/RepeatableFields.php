<?php

namespace App;

use App\Models\Content;
use App\Models\ContentFieldValue;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RepeatableFields
{
    public static function schema(array $fields, string $scope, ?int $projectId, ?int $universeId, int $depth): array
    {
        if ($depth > 3) {
            throw ValidationException::withMessages(['entry_fields' => 'Un groupe peut contenir au maximum trois niveaux de listes structurées.']);
        }
        Validator::make(['fields' => $fields], [
            'fields' => ['array', 'list', 'max:20'],
            'fields.*.key' => ['required', 'uuid', 'distinct:ignore_case'],
        ])->validate();
        $schema = [];
        foreach ($fields as $field) {
            $key = $field['key'];
            unset($field['key']);
            $field['section'] ??= 'Groupe';
            $validated = Validator::make(['fields' => [$field]], FieldSchema::rules())->validate()['fields'][0];
            if ($validated['type'] === 'json' || isset($validated['id'])) {
                throw ValidationException::withMessages(['entry_fields' => 'Choisis un type de champ pris en charge pour chaque membre du groupe.']);
            }
            $definition = new FieldDefinition(FieldSchema::definitionAttributes($validated, $scope, $projectId, $universeId, $depth));
            $schema[] = [
                'key' => $key, 'field_definition' => ['label' => $definition->label, 'value_type' => $definition->value_type, 'options_data' => $definition->options_data],
                'display_options' => FieldSchema::displayOptions($validated, $definition),
                'is_required' => $validated['required'] ?? false,
                'help_text' => $validated['help'] ?? null, 'default_value' => $validated['default_value'] ?? null,
            ];
        }

        return $schema;
    }

    public static function validate(array $entries, array $schema, Content $content, array $previous = []): void
    {
        $keys = array_column($schema, 'key');
        $oldEntries = collect($previous)->keyBy('id');
        foreach ($entries as $entry) {
            $values = $entry['values'] ?? [];
            if (array_diff(array_keys($values), $keys) !== []) {
                throw ValidationException::withMessages(['value_json' => 'Un champ intégré ne fait pas partie du groupe.']);
            }
            foreach ($schema as $field) {
                $value = $values[$field['key']] ?? null;
                if ($value === null) {
                    if ($field['is_required']) {
                        throw ValidationException::withMessages(['value_json' => 'Le champ intégré « '.$field['field_definition']['label'].' » est obligatoire.']);
                    }

                    continue;
                }
                Validator::make(['default_value' => $value], FieldSchema::defaultRules('default_value'))->validate();
                if ($field['is_required'] && isset($value['value_text']) && trim($value['value_text']) === '') {
                    throw ValidationException::withMessages(['value_json' => 'Un champ intégré obligatoire ne peut pas être vide.']);
                }
                $old = $oldEntries->get($entry['id'] ?? '')['values'][$field['key']] ?? [];
                $nested = new ContentFieldValue($old);
                $nested->syncOriginal();
                $nested->fill(array_fill_keys([...array_values(ContentFieldValue::VALUE_COLUMNS), 'value_state'], null));
                $nested->fill($value);
                $nested->validateForContent(new FieldDefinition($field['field_definition'] + [
                    'scope_type' => $content->scope_type, 'project_id' => $content->project_id, 'universe_id' => $content->universe_id,
                ]), $content, $field['display_options']);
            }
        }
    }

    public static function assertGlobal(array $definition, ?array $default = null): void
    {
        $options = $definition['options_data'] ?? [];
        $types = $options['content_type_ids'] ?? [];
        if ($types !== [] && ContentType::whereKey($types)->whereIn('scope_type', ['system', 'global'])->count() !== count(array_unique($types))) {
            abort(422, 'Ce groupe utilise un type de fiche propre au projet.');
        }
        if (($definition['value_type'] === 'reference' && isset($default['reference_content_id']))
            || (in_array($options['format'] ?? null, ['references', 'image'], true) && isset($default['value_json']))) {
            abort(422, 'Ce groupe utilise une référence ou une image par défaut propre au projet.');
        }
        foreach ($options['entry_fields'] ?? [] as $field) {
            self::assertGlobal($field['field_definition'], $field['default_value']);
            foreach ($default['value_json'] ?? [] as $entry) {
                self::assertGlobal($field['field_definition'], $entry['values'][$field['key']] ?? null);
            }
        }
    }

    public static function dates(array $entries, array $schema, string $prefix = ''): array
    {
        $dates = [];
        foreach ($entries as $entry) {
            if (empty($entry['id'])) {
                continue;
            }
            $id = $prefix.$entry['id'];
            if (! empty($entry['date']['timeline'])) {
                $dates[] = ['id' => $id, 'label' => $entry['label'], 'date' => $entry['date']];
            }
            foreach ($schema as $field) {
                $value = $entry['values'][$field['key']]['value_json'] ?? null;
                $options = $field['field_definition']['options_data'] ?? [];
                if (($options['format'] ?? null) === 'temporal' && ! empty($value['timeline'])) {
                    $dates[] = ['id' => $id.':'.$field['key'], 'label' => $entry['label'].' · '.$field['field_definition']['label'], 'date' => $value];
                } elseif (($options['format'] ?? null) === 'repeatable' && is_array($value)) {
                    array_push($dates, ...self::dates($value, $options['entry_fields'] ?? [], $id.':'.$field['key'].':'));
                }
            }
        }

        return $dates;
    }
}
