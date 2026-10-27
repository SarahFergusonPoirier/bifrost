<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use LogicException;

class ContentType extends Model
{
    protected $fillable = [
        'key', 'name', 'description', 'scope_type', 'project_id', 'universe_id',
        'is_system', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_system' => 'boolean', 'is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (ContentType $contentType): void {
            if (empty($contentType->public_id)) {
                $contentType->public_id = (string) Str::uuid();
            }
        });

        static::saving(function (ContentType $contentType): void {
            $contentType->validateScope();
        });

        static::updating(function (ContentType $contentType): void {
            if ($contentType->getOriginal('is_system')) {
                $changes = $contentType->getDirty();
                unset($changes['updated_at']);

                if ($changes !== []) {
                    throw new LogicException('Les types de contenu système ne peuvent pas être modifiés.');
                }
            }
        });

        static::deleting(function (ContentType $contentType): void {
            if ($contentType->is_system) {
                throw new LogicException('Les types de contenu système ne peuvent pas être supprimés.');
            }
        });
    }

    private function validateScope(): void
    {
        $hasProject = $this->project_id !== null;
        $hasUniverse = $this->universe_id !== null;

        $valid = match ($this->scope_type) {
            'system', 'global' => ! $hasProject && ! $hasUniverse,
            'project' => $hasProject && ! $hasUniverse,
            'universe' => ! $hasProject && $hasUniverse,
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'scope_type' => 'La portée du type de contenu doit correspondre à ses références de projet ou d’univers.',
            ]);
        }
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function universe(): BelongsTo
    {
        return $this->belongsTo(Universe::class);
    }

    public function contents(): HasMany
    {
        return $this->hasMany(Content::class);
    }
}
