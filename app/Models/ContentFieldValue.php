<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

class ContentFieldValue extends Model
{
    protected $fillable = [
        'content_id', 'field_definition_id', 'value_text', 'value_number',
        'value_boolean', 'value_date', 'value_json', 'reference_content_id',
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

            if (count($present) !== 1 || ! isset($present[$expected])) {
                throw ValidationException::withMessages(['value' => 'Une seule valeur compatible avec le type du champ doit être renseignée.']);
            }

            if ($definition->value_type === 'reference') {
                $target = Content::query()->find($value->reference_content_id);
                $allowed = $definition->options_data['content_type_ids'] ?? null;
                if (! $target || ($allowed && ! in_array($target->content_type_id, $allowed))) {
                    throw ValidationException::withMessages(['reference_content_id' => 'Le contenu cible de la référence n’est pas autorisé.']);
                }
            }
        });
    }

    public function content(): BelongsTo { return $this->belongsTo(Content::class); }
    public function fieldDefinition(): BelongsTo { return $this->belongsTo(FieldDefinition::class); }
    public function referenceContent(): BelongsTo { return $this->belongsTo(Content::class, 'reference_content_id'); }
}