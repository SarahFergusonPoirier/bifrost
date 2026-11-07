<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;
use LogicException;

class TemplateVersionField extends Model
{
    protected $fillable = [
        'template_version_id', 'field_definition_id', 'section_key', 'position',
        'is_required', 'default_value', 'display_options', 'label_override', 'help_text',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_required' => 'boolean',
            'default_value' => 'array',
            'display_options' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (TemplateVersionField $field): void {
            $version = TemplateVersion::query()->find($field->template_version_id);
            if ($version?->published_at !== null) {
                throw new LogicException('Les champs d’une version publiée sont immuables.');
            }

            $definition = FieldDefinition::query()->find($field->field_definition_id);
            $template = $version?->template;
            if ($definition && $template) {
                $compatible = $definition->scope_type === 'global'
                    || ($definition->scope_type === 'project'
                        && $template->scope_type === 'project'
                        && (string) $definition->project_id === (string) $template->project_id)
                    || ($definition->scope_type === 'universe'
                        && $template->scope_type === 'universe'
                        && (string) $definition->universe_id === (string) $template->universe_id);

                if (! $compatible) {
                    throw ValidationException::withMessages([
                        'field_definition_id' => 'La portée du champ n’est pas compatible avec celle du modèle.',
                    ]);
                }
            }
        });

        static::deleting(function (TemplateVersionField $field): void {
            if ($field->version?->published_at !== null) {
                throw new LogicException('Les champs d’une version publiée sont immuables.');
            }
        });
    }

    public function version(): BelongsTo { return $this->belongsTo(TemplateVersion::class, 'template_version_id'); }
    public function fieldDefinition(): BelongsTo { return $this->belongsTo(FieldDefinition::class); }
}