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

    public const WORK_STATUS_KEYS = [
        'draft',
        'in_progress',
        'completed',
        'abandoned',
    ];

    protected $attributes = [
        'work_status_key' => 'draft',
    ];

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
            $content->validateWorkStatus();
            $content->validateContentTypeScope();
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

    private function validateWorkStatus(): void
    {
        if (! in_array($this->work_status_key, self::WORK_STATUS_KEYS, true)) {
            throw ValidationException::withMessages([
                'work_status_key' => 'Le statut de travail doit être une valeur autorisée.',
            ]);
        }
    }

    private function validateContentTypeScope(): void
    {
        $contentType = ContentType::query()->find($this->content_type_id);

        if (! $contentType) {
            return;
        }

        $valid = match ($contentType->scope_type) {
            'project' => $this->scope_type === 'project'
                && (string) $this->project_id === (string) $contentType->project_id,
            'universe' => $this->scope_type === 'universe'
                && (string) $this->universe_id === (string) $contentType->universe_id,
            default => true,
        };

        if (! $valid) {
            throw ValidationException::withMessages([
                'content_type_id' => 'Le type de contenu doit être accessible dans la même portée que le contenu.',
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
