<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

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
