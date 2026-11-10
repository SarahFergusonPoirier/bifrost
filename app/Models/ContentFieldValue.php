<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ContentFieldValue extends Model
{
    protected $fillable = [
        'content_id', 'field_definition_id', 'value_text', 'value_number',
        'value_boolean', 'value_date', 'value_json', 'reference_content_id', 'value_state',
    ];

    protected function casts(): array
    {
        return [
            'value_number' => 'decimal:6',
            'value_boolean' => 'boolean',
            'value_date' => 'date',
            'value_json' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ContentFieldValue $value): void {
            $definition = FieldDefinition::query()->find($value->field_definition_id);
            $content = Content::query()->find($value->content_id);
            if (! $definition || ! $content) {
                return;
            }

            $scopeCompatible = $definition->scope_type === 'global'
                || ($definition->scope_type === 'project' && $content->scope_type === 'project'
                    && (string) $definition->project_id === (string) $content->project_id)
                || ($definition->scope_type === 'universe' && $content->scope_type === 'universe'
                    && (string) $definition->universe_id === (string) $content->universe_id);

            if (! $scopeCompatible) {
                throw ValidationException::withMessages(['field_definition_id' => 'Le champ n’est pas accessible dans la portée de ce contenu.']);
            }

            $columns = [
                'text' => 'value_text',
                'number' => 'value_number',
                'boolean' => 'value_boolean',
                'date' => 'value_date',
                'choice' => 'value_text',
                'reference' => 'reference_content_id',
                'json' => 'value_json',
            ];
            $expected = $columns[$definition->value_type] ?? null;
            $present = array_filter([
                'value_text' => $value->value_text !== null,
                'value_number' => $value->value_number !== null,
                'value_boolean' => $value->value_boolean !== null,
                'value_date' => $value->value_date !== null,
                'value_json' => $value->value_json !== null,
                'reference_content_id' => $value->reference_content_id !== null,
            ]);

            if ($value->value_state !== null) {
                if ($present !== [] || ! in_array($value->value_state, ['unknown', 'not_applicable'], true)) {
                    throw ValidationException::withMessages(['value_state' => 'Un état explicite ne peut pas accompagner une valeur.']);
                }

                return;
            }

            if (count($present) !== 1 || ! isset($present[$expected])) {
                throw ValidationException::withMessages(['value' => 'Une seule valeur compatible avec le type du champ doit être renseignée.']);
            }

            $multipleChoice = ($definition->options_data['format'] ?? null) === 'multiple_choice';
            if ($definition->value_type === 'choice' || $multipleChoice) {
                $configuration = $content->templateAssignment()->first()?->templateVersion
                    ->fields()->where('field_definition_id', $definition->id)->first()?->display_options;
                $choices = $configuration['choices'] ?? $definition->options_data['choices'] ?? [];
                $selected = $multipleChoice ? $value->value_json : [$value->value_text];

                if (! array_is_list($selected) || collect($selected)->contains(fn ($item) => ! is_string($item) || ($choices !== [] && ! in_array($item, $choices, true)))) {
                    throw ValidationException::withMessages(['value' => 'Une option choisie ne figure pas dans la liste du champ.']);
                }
            }

            if ($definition->value_type === 'json') {
                $value->validateStructuredValue($definition, $content);
            }

            if ($definition->value_type === 'reference') {
                $target = Content::query()->find($value->reference_content_id);
                $allowed = $definition->options_data['content_type_ids'] ?? null;
                if (! $target || ($allowed && ! in_array($target->content_type_id, $allowed))
                    || ($target->project_id !== null && $content->project_id !== null
                        && (int) $target->project_id !== (int) $content->project_id)) {
                    throw ValidationException::withMessages(['reference_content_id' => 'Le contenu cible de la référence n’est pas autorisé.']);
                }
            }
        });
    }

    private function scaleLimit(FieldDefinition $definition, Content $content): int
    {
        $display = $content->templateAssignment()->first()?->templateVersion
            ->fields()->where('field_definition_id', $definition->id)->first()?->display_options;
        $limit = (int) ($display['scale_levels'] ?? $definition->options_data['levels'] ?? 5);
        $previous = $this->getOriginal('value_json')['level'] ?? null;
        $level = $this->value_json['level'] ?? null;

        return $previous !== null && is_numeric($level) && (int) $level === (int) $previous
            ? max($limit, (int) $previous) : $limit;
    }

    private function validateStructuredValue(FieldDefinition $definition, Content $content): void
    {
        $format = $definition->options_data['format'] ?? null;
        $rules = match ($format) {
            'external_link' => [
                'value_json' => ['required', 'array:url,label'],
                'value_json.url' => ['required', 'string', 'max:2048', 'url:http,https'],
                'value_json.label' => ['nullable', 'string', 'max:255'],
            ],
            'keywords', 'equipment', 'capabilities', 'repeatable', 'bullets' => [
                'value_json' => ['array', 'list', 'min:1', 'max:100'],
                'value_json.*' => ['required', 'array:label'.(match ($format) {
                    'equipment' => ',description,image', 'capabilities' => ',description,category,mastery', 'repeatable' => ',id,description,period,date,level,rank', 'bullets' => '', default => ',description'
                })],
                'value_json.*.id' => ['required_with:value_json.*.date', 'uuid', 'distinct:ignore_case'],
                'value_json.*.label' => ['required', 'string', 'max:120'],
                'value_json.*.description' => ['nullable', 'string', 'max:1000'],
                'value_json.*.image' => ['nullable', 'uuid'],
                'value_json.*.category' => ['nullable', 'string', 'max:120'],
                'value_json.*.mastery' => ['nullable', 'integer', 'between:1,5'],
                'value_json.*.period' => ['nullable', 'string', 'max:255'],
                ...($format === 'repeatable' ? $this->temporalRules('value_json.*.date') : []),
                'value_json.*.level' => ['nullable', 'string', 'max:120'],
                'value_json.*.rank' => ['nullable', 'integer', 'between:1,5'],
            ],
            'scale' => [
                'value_json' => ['array:level', 'required'],
                'value_json.level' => ['required', 'integer', 'between:1,'.$this->scaleLimit($definition, $content)],
            ],
            'measurement' => [
                'value_json' => ['array:amount,unit', 'min:1'],
                'value_json.amount' => ['sometimes', 'numeric'],
                'value_json.unit' => ['sometimes', 'string', 'max:80'],
            ],
            'coordinates' => [
                'value_json' => ['array:x,y', 'min:1'],
                'value_json.x' => ['sometimes', 'numeric'],
                'value_json.y' => ['sometimes', 'numeric'],
            ],
            'temporal' => $this->temporalRules('value_json'),
            'references' => [
                'value_json' => ['array', 'list', 'min:1', 'max:200'],
                'value_json.*' => ['required', 'uuid', 'distinct:ignore_case'],
            ],
            default => [],
        };

        Validator::make(['value_json' => $this->value_json], $rules)->validate();

        if ($format === 'equipment') {
            $ids = collect($this->value_json)->pluck('image')->filter()->unique();
            $previous = collect($this->getOriginal('value_json') ?? [])->pluck('image')->filter();
            $added = $ids->diff($previous);
            if ($added->isNotEmpty() && $content->resources()->where('storage_mode', 'imported')
                ->where('location', 'like', 'content-attachments/%')->whereIn('public_id', $added)->count() !== $added->count()) {
                throw ValidationException::withMessages(['value_json' => 'Une image ne fait pas partie des pièces jointes de la fiche.']);
            }
        }

        if ($format === 'references') {
            $original = $this->getOriginal('value_json') ?? [];
            $added = array_diff($this->value_json, $original);
            $targets = Content::where('project_id', $content->project_id)
                ->where('universe_id', $content->universe_id)
                ->where('scope_type', $content->scope_type)
                ->where('public_id', '!=', $content->public_id)
                ->whereIn('public_id', $added);
            $allowed = $definition->options_data['content_type_ids'] ?? [];
            if ($allowed !== []) {
                $targets->whereIn('content_type_id', $allowed);
            }

            if ($targets->count() !== count($added)) {
                throw ValidationException::withMessages(['value_json' => 'Une fiche liée est indisponible dans cet espace.']);
            }
        }
    }

    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }

    public function fieldDefinition(): BelongsTo
    {
        return $this->belongsTo(FieldDefinition::class);
    }

    public function referenceContent(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'reference_content_id');
    }

    public function timelineDates(): array
    {
        $value = $this->value_json ?? [];
        if (! array_is_list($value)) {
            return empty($value['timeline']) ? [] : [['id' => null, 'label' => null, 'date' => $value]];
        }

        $dates = [];
        foreach ($value as $entry) {
            if (! empty($entry['id']) && ! empty($entry['date']['timeline'])) {
                $dates[] = ['id' => $entry['id'], 'label' => $entry['label'], 'date' => $entry['date']];
            }
        }

        return $dates;
    }

    private function temporalRules(string $path): array
    {
        return [
            $path => ['array:precision,start,end,calendar,order,timeline,timeline_title,timeline_description', 'min:1'],
            $path.'.precision' => ['sometimes', 'in:exact,approximate,range,relative,unknown'],
            $path.'.start' => ['sometimes', 'string', 'max:255'],
            $path.'.end' => ['sometimes', 'string', 'max:255'],
            $path.'.calendar' => ['sometimes', 'string', 'max:255'],
            $path.'.order' => ['sometimes', 'integer', 'between:-1000000000,1000000000'],
            $path.'.timeline' => ['sometimes', 'boolean'],
            $path.'.timeline_title' => ['sometimes', 'string', 'max:255'],
            $path.'.timeline_description' => ['sometimes', 'string', 'max:10000'],
        ];
    }
}
