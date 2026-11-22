<?php

namespace App\Models;

use App\FieldSchema;
use App\RepeatableFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ContentFieldValue extends Model
{
    private ?array $validationDisplay = null;

    public const VALUE_COLUMNS = [
        'text' => 'value_text', 'number' => 'value_number', 'boolean' => 'value_boolean',
        'date' => 'value_date', 'choice' => 'value_text', 'reference' => 'reference_content_id', 'json' => 'value_json',
    ];

    protected $fillable = [
        'content_id', 'field_definition_id', 'value_text', 'value_number',
        'value_boolean', 'value_date', 'value_json', 'reference_content_id', 'value_state', 'date_options',
    ];

    protected function casts(): array
    {
        return [
            'value_number' => 'decimal:6',
            'value_boolean' => 'boolean',
            'value_date' => 'date',
            'date_options' => 'array',
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

            $value->validateForContent($definition, $content);
        });
    }

    public function validateForContent(FieldDefinition $definition, Content $content, ?array $display = null): void
    {
        $this->validationDisplay = $display;
        $scopeCompatible = $definition->scope_type === 'global'
            || ($definition->scope_type === 'project' && $content->scope_type === 'project'
                && (string) $definition->project_id === (string) $content->project_id)
            || ($definition->scope_type === 'universe' && $content->scope_type === 'universe'
                && (string) $definition->universe_id === (string) $content->universe_id);

        if (! $scopeCompatible) {
            throw ValidationException::withMessages(['field_definition_id' => 'Le champ n’est pas accessible dans la portée de ce contenu.']);
        }

        $expected = self::VALUE_COLUMNS[$definition->value_type] ?? null;
        $present = array_filter([
            'value_text' => $this->value_text !== null,
            'value_number' => $this->value_number !== null,
            'value_boolean' => $this->value_boolean !== null,
            'value_date' => $this->value_date !== null,
            'value_json' => $this->value_json !== null,
            'reference_content_id' => $this->reference_content_id !== null,
        ]);

        if ($this->date_options !== null) {
            if ($definition->value_type !== 'date' || $this->value_date === null || $this->value_state !== null) {
                throw ValidationException::withMessages(['date_options' => 'Les options de chronologie exigent une date renseignée.']);
            }
            Validator::make(['date_options' => $this->date_options], FieldSchema::dateOptionsRules('date_options'))->validate();
        }

        if ($this->value_state !== null) {
            if ($present !== [] || ! in_array($this->value_state, ['unknown', 'not_applicable'], true)) {
                throw ValidationException::withMessages(['value_state' => 'Un état explicite ne peut pas accompagner une valeur.']);
            }

            return;
        }

        if (count($present) !== 1 || ! isset($present[$expected])) {
            throw ValidationException::withMessages(['value' => 'Une seule valeur compatible avec le type du champ doit être renseignée.']);
        }

        $multipleChoice = ($definition->options_data['format'] ?? null) === 'multiple_choice';
        if ($definition->value_type === 'choice' || $multipleChoice) {
            $configuration = $this->fieldDisplayOptions($definition, $content);
            $choices = $configuration['choices'] ?? $definition->options_data['choices'] ?? [];
            $selected = $multipleChoice ? $this->value_json : [$this->value_text];
            $previous = $multipleChoice ? ($this->getOriginal('value_json') ?? []) : [$this->getOriginal('value_text')];

            if (! array_is_list($selected) || collect($selected)->contains(fn ($item) => ! is_string($item) || ($choices !== [] && ! in_array($item, $choices, true) && ! in_array($item, $previous, true)))) {
                throw ValidationException::withMessages(['value' => 'Une option choisie ne figure pas dans la liste du champ.']);
            }
        }

        if ($definition->value_type === 'json') {
            $this->validateStructuredValue($definition, $content);
        }

        if ($definition->value_type === 'reference') {
            $target = Content::query()->find($this->reference_content_id);
            $allowed = $definition->options_data['content_type_ids'] ?? null;
            if (! $target || ($allowed && ! in_array($target->content_type_id, $allowed))
                || ($target->project_id !== null && $content->project_id !== null
                    && (int) $target->project_id !== (int) $content->project_id)) {
                throw ValidationException::withMessages(['reference_content_id' => 'Le contenu cible de la référence n’est pas autorisé.']);
            }
        }
    }

    private function scaleLimit(FieldDefinition $definition, Content $content): int
    {
        $display = $this->fieldDisplayOptions($definition, $content);
        $limit = (int) ($display['scale_levels'] ?? $definition->options_data['levels'] ?? 5);
        $previous = $this->getOriginal('value_json')['level'] ?? null;
        $level = $this->value_json['level'] ?? null;

        return $previous !== null && is_numeric($level) && (int) $level === (int) $previous
            ? max($limit, (int) $previous) : $limit;
    }

    private function fieldDisplayOptions(FieldDefinition $definition, Content $content): array
    {
        if ($this->validationDisplay !== null) {
            return $this->validationDisplay;
        }
        $field = $content->templateAssignment()->first()?->templateVersion
            ->fields()->where('field_definition_id', $definition->id)->first();
        if ($field) {
            return $field->display_options ?? [];
        }
        $blockField = $content->blocks()->where('block_type', 'fields')->get(['field_schema'])
            ->flatMap(fn ($block): array => $block->field_schema ?? [])->firstWhere('field_definition_id', $definition->id);

        return $blockField['display_options'] ?? [];
    }

    private function validateStructuredValue(FieldDefinition $definition, Content $content): void
    {
        $format = $definition->options_data['format'] ?? null;
        $rules = match ($format) {
            'attachment' => [
                'value_json' => ['required', 'array:attachment'],
                'value_json.attachment' => ['required', 'uuid'],
            ],
            'image' => [
                'value_json' => ['required', 'array:image'],
                'value_json.image' => ['required', 'uuid'],
            ],
            'external_link' => [
                'value_json' => ['required', 'array:url,label'],
                'value_json.url' => ['required', 'string', 'max:2048', 'url:http,https'],
                'value_json.label' => ['nullable', 'string', 'max:255'],
            ],
            'keywords', 'equipment', 'capabilities', 'repeatable', 'bullets' => [
                'value_json' => ['array', 'list', 'min:1', 'max:100'],
                'value_json.*' => ['required', 'array:label'.(match ($format) {
                    'equipment' => ',description,image,fields', 'capabilities' => ',description,category,mastery,fields', 'repeatable' => ',id,description,period,date,level,rank,values', 'bullets' => '', default => ',description'
                })],
                'value_json.*.id' => ['required_with:value_json.*.date,value_json.*.values', 'uuid', 'distinct:ignore_case'],
                'value_json.*.label' => ['required', 'string', 'max:120'],
                'value_json.*.description' => $format === 'capabilities' ? ['nullable', 'string'] : ['nullable', 'string', 'max:1000'],
                'value_json.*.image' => ['nullable', 'uuid'],
                'value_json.*.category' => ['nullable', 'string', 'max:120'],
                'value_json.*.mastery' => ['nullable', 'integer', 'between:1,5'],
                'value_json.*.fields' => ['sometimes', 'array', 'list', 'max:20'],
                'value_json.*.fields.*' => ['required', 'array:id,label,value'],
                'value_json.*.fields.*.id' => ['required', 'uuid', 'distinct:ignore_case'],
                'value_json.*.fields.*.label' => ['required', 'string', 'max:120'],
                'value_json.*.fields.*.value' => ['present', 'nullable', 'string', 'max:1000'],
                'value_json.*.period' => ['nullable', 'string', 'max:255'],
                ...($format === 'repeatable' ? $this->temporalRules('value_json.*.date') : []),
                'value_json.*.level' => ['nullable', 'string', 'max:120'],
                'value_json.*.rank' => ['nullable', 'integer', 'between:1,5'],
                'value_json.*.values' => ['sometimes', 'array'],
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
        if ($format === 'attachment' && ($this->value_json['attachment'] ?? null) !== ($this->getOriginal('value_json')['attachment'] ?? null)) {
            $attachment = $content->resources()->where('storage_mode', 'imported')->where('public_id', $this->value_json['attachment'])->first();
            if (! $attachment || preg_match('/\Acontent-attachments\/[0-9a-f-]{36}\z/', $attachment->location) !== 1) {
                throw ValidationException::withMessages(['value_json.attachment' => 'Choisis un fichier joint à cette fiche.']);
            }
        }
        if ($format === 'repeatable') {
            $display = $this->fieldDisplayOptions($definition, $content);
            RepeatableFields::validate($this->value_json, $display['entry_fields'] ?? $definition->options_data['entry_fields'] ?? [], $content, $this->getOriginal('value_json') ?? []);
        }

        if ($format === 'image' && ($this->value_json['image'] ?? null) !== ($this->getOriginal('value_json')['image'] ?? null)) {
            $image = $content->resources()->where('storage_mode', 'imported')
                ->where('public_id', $this->value_json['image'])->first();
            if (! $image?->attachmentImageMime()) {
                throw ValidationException::withMessages(['value_json.image' => 'Choisis une image jointe à cette fiche.']);
            }
        }

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
        if ($this->value_date !== null && ! empty($this->date_options['timeline'])) {
            return [['id' => null, 'label' => null, 'date' => ['start' => $this->value_date->format('Y-m-d'), 'precision' => 'exact'] + $this->date_options]];
        }
        $value = $this->value_json ?? [];
        if (! array_is_list($value)) {
            return empty($value['timeline']) ? [] : [['id' => null, 'label' => null, 'date' => $value]];
        }

        $definition = $this->fieldDefinition;
        $display = $definition ? $this->fieldDisplayOptions($definition, $this->content) : [];

        return RepeatableFields::dates($value, $display['entry_fields'] ?? $definition?->options_data['entry_fields'] ?? []);
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
