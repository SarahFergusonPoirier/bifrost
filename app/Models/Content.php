<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class Content extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'content_type_id', 'title', 'summary', 'work_status_key', 'scope_type',
        'project_id', 'universe_id', 'origin_content_id', 'archived_at',
    ];

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (Content $content): void {
            if (empty($content->public_id)) {
                $content->public_id = (string) Str::uuid();
            }
        });

        static::saving(function (Content $content): void {
            $content->validateScope();
        });
    }

    private function validateScope(): void
    {
        $hasProject = $this->project_id !== null;
        $hasUniverse = $this->universe_id !== null;

        $valid = match ($this->scope_type) {
            'global' => ! $hasProject && ! $hasUniverse,
            'project' => $hasProject && ! $hasUniverse,
            'universe' => ! $hasProject && $hasUniverse,
            default => false,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'scope_type' => 'La portée du contenu doit correspondre à sa référence de projet ou d’univers.',
            ]);
        }
    }

    public function contentType(): BelongsTo
    {
        return $this->belongsTo(ContentType::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function universe(): BelongsTo
    {
        return $this->belongsTo(Universe::class);
    }

    public function originContent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'origin_content_id');
    }

    public function derivedContents(): HasMany
    {
        return $this->hasMany(self::class, 'origin_content_id');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(ContentBlock::class)->orderBy('position');
    }
}
