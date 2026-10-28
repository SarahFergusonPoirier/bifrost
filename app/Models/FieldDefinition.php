<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FieldDefinition extends Model
{
    use SoftDeletes;

    public const VALUE_TYPES = ['text', 'number', 'boolean', 'date', 'choice', 'reference', 'json'];

    protected $fillable = [
        'key', 'label', 'description', 'value_type', 'scope_type',
        'project_id', 'universe_id', 'options_data', 'is_active',
    ];

    protected function casts(): array
    {
        return ['options_data' => 'array', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (FieldDefinition $field): void {
            $field->public_id = $field->public_id ?: (string) Str::uuid();
        });

        static::saving(function (FieldDefinition $field): void {
            // Apply the same default as the database before validating the model.
            $field->scope_type ??= 'global';

            $scopeValid = match ($field->scope_type) {
                'global' => $field->project_id === null && $field->universe_id === null,
                'project' => $field->project_id !== null && $field->universe_id === null,
                'universe' => $field->project_id === null && $field->universe_id !== null,
                default => false,
            };

            if (! $scopeValid) {
                throw ValidationException::withMessages(['scope_type' => 'La portée du champ est invalide.']);
            }

            if (! in_array($field->value_type, self::VALUE_TYPES, true)) {
                throw ValidationException::withMessages(['value_type' => 'Le type de valeur du champ est inconnu.']);
            }

            if ($field->exists && $field->isDirty('value_type') && $field->values()->exists()) {
                throw ValidationException::withMessages([
                    'value_type' => 'Le type d’un champ déjà utilisé ne peut pas être changé; créez une nouvelle définition.',
                ]);
            }
        });
    }

    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function universe(): BelongsTo { return $this->belongsTo(Universe::class); }
    public function templateVersionFields(): HasMany { return $this->hasMany(TemplateVersionField::class); }
    public function values(): HasMany { return $this->hasMany(ContentFieldValue::class); }
}