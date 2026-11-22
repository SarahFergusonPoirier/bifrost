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
                $old = $oldEntries->get($entry['id'] ?? '')['values'][$field['key']] ?? null;
                if (! empty($field['retired'])) {
                    if ($old !== null && $value != $old) {
                        throw ValidationException::withMessages(['value_json' => 'Les valeurs des sous-champs retirés restent conservées.']);
                    }
                    if ($value == $old) {
                        continue;
                    }
                }
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
                $nested = new ContentFieldValue($old ?? []);
                $nested->syncOriginal();
                $nested->fill(array_fill_keys([...array_values(ContentFieldValue::VALUE_COLUMNS), 'value_state'], null));
                $nested->fill($value);
                $nested->validateForContent(new FieldDefinition($field['field_definition'] + [
                    'scope_type' => $content->scope_type, 'project_id' => $content->project_id, 'universe_id' => $content->universe_id,
                ]), $content, $field['display_options']);
            }
        }
    }

    public static function revise(array $next, array $previous, array $specs): array
    {
        $known = collect($previous)->keyBy('key');
        $inputs = collect($specs)->keyBy('key');
        $result = [];
        foreach ($next as $field) {
            $old = $known->get($field['key']);
            if ($old) {
                $original = new FieldDefinition($old['field_definition']);
                $replacement = $field['field_definition'];
                if ($original->value_type !== $replacement['value_type']
                    || ($original->options_data['format'] ?? null) !== ($replacement['options_data']['format'] ?? null)
                    || ($original->options_data['content_type_ids'] ?? []) != ($replacement['options_data']['content_type_ids'] ?? [])) {
                    throw ValidationException::withMessages(['entry_fields' => 'Ajoute un nouveau sous-champ pour changer son type ou ses références. Les anciennes valeurs restent conservées.']);
                }
                $input = $inputs->get($field['key']);
                $input['section'] ??= 'Groupe';
                $children = $input['entry_fields'] ?? null;
                unset($input['entry_fields']);
                $field['display_options'] = FieldSchema::displayOptions($input, $original, $old['display_options'] ?? [], existing: true);
                if ($children !== null) {
                    $field['display_options']['entry_fields'] = self::revise($replacement['options_data']['entry_fields'] ?? [],
                        $old['display_options']['entry_fields'] ?? $original->options_data['entry_fields'] ?? [], $children);
                }
                $field['field_definition'] = [...$old['field_definition'], 'label' => $replacement['label']];
            }
            $result[] = $field;
        }
        $active = array_column($next, 'key');
        foreach ($previous as $field) {
            if (! in_array($field['key'], $active, true)) {
                $result[] = [...$field, 'retired' => true];
            }
        }

        return $result;
    }

    public static function assertGlobal(array $definition, ?array $default = null, array $display = []): void
    {
        $options = $definition['options_data'] ?? [];
        $types = $options['content_type_ids'] ?? [];
        if ($types !== [] && ContentType::whereKey($types)->whereIn('scope_type', ['system', 'global'])->count() !== count(array_unique($types))) {
            abort(422, 'Ce groupe utilise un type de fiche propre au projet.');
        }
        if (($definition['value_type'] === 'reference' && isset($default['reference_content_id']))
            || (in_array($options['format'] ?? null, ['references', 'image', 'attachment'], true) && isset($default['value_json']))
            || (($options['format'] ?? null) === 'equipment' && collect($default['value_json'] ?? [])->contains(fn ($entry): bool => is_array($entry) && ! empty($entry['image'])))) {
            abort(422, 'Ce modèle utilise une référence ou un fichier par défaut propre au projet.');
        }
        foreach ($display['entry_fields'] ?? $options['entry_fields'] ?? [] as $field) {
            self::assertGlobal($field['field_definition'], $field['default_value'], $field['display_options'] ?? []);
            foreach ($default['value_json'] ?? [] as $entry) {
                self::assertGlobal($field['field_definition'], $entry['values'][$field['key']] ?? null, $field['display_options'] ?? []);
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
                    array_push($dates, ...self::dates($value, $field['display_options']['entry_fields'] ?? $options['entry_fields'] ?? [], $id.':'.$field['key'].':'));
                }
            }
        }

        return $dates;
    }
}
