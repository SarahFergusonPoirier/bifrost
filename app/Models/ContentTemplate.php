<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;

class ContentTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'description', 'content_type_id', 'scope_type',
        'project_id', 'universe_id', 'base_template_id', 'is_system', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_system' => 'boolean', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (ContentTemplate $template): void {
            $template->public_id = $template->public_id ?: (string) Str::uuid();
        });

        static::saving(function (ContentTemplate $template): void {
            $template->validateScope();
        });

        static::updating(function (ContentTemplate $template): void {
            if ($template->getOriginal('is_system')) {
                $dirty = $template->getDirty();
                unset($dirty['updated_at']);
                if ($dirty !== []) {
                    throw new LogicException('Les modèles système ne peuvent pas être modifiés.');
                }
            }
        });

        static::deleting(function (ContentTemplate $template): void {
            if ($template->is_system) {
                throw new LogicException('Les modèles système ne peuvent pas être supprimés.');
            }
        });
    }

    private function validateScope(): void
    {
        $valid = match ($this->scope_type) {
            'global' => $this->project_id === null && $this->universe_id === null,
            'project' => $this->project_id !== null && $this->universe_id === null,
            'universe' => $this->project_id === null && $this->universe_id !== null,
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'scope_type' => 'La portée du modèle doit correspondre à sa référence de projet ou d’univers.',
            ]);
        }

        $type = ContentType::query()->find($this->content_type_id);
        if (! $type) {
            return;
        }

        $compatible = match ($type->scope_type) {
            'project' => $this->scope_type === 'project' && (string) $this->project_id === (string) $type->project_id,
            'universe' => $this->scope_type === 'universe' && (string) $this->universe_id === (string) $type->universe_id,
            default => true,
        };

        if (! $compatible) {
            throw ValidationException::withMessages([
                'content_type_id' => 'Le type de contenu et le modèle doivent avoir des portées compatibles.',
            ]);
        }
    }

    public function contentType(): BelongsTo { return $this->belongsTo(ContentType::class); }
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function universe(): BelongsTo { return $this->belongsTo(Universe::class); }
    public function baseTemplate(): BelongsTo { return $this->belongsTo(self::class, 'base_template_id'); }
    public function derivedTemplates(): HasMany { return $this->hasMany(self::class, 'base_template_id'); }
    public function versions(): HasMany { return $this->hasMany(TemplateVersion::class, 'template_id')->orderBy('version_number'); }
    public function assignments(): HasMany { return $this->hasMany(ContentTemplateAssignment::class, 'template_id'); }
}