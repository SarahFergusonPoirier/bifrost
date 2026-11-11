<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Universe extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'description', 'settings'];

    protected function casts(): array
    {
        return ['settings' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (Universe $universe): void {
            if (empty($universe->public_id)) {
                $universe->public_id = (string) Str::uuid();
            }
        });
    }

    /** @return list<string> */
    public function relationTypes(): array
    {
        $types = $this->settings['relation_types'] ?? [];

        return array_values(array_filter((array) $types,
            fn ($type): bool => is_string($type) && preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $type) === 1));
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class)
            ->withPivot('usage_type')
            ->withTimestamps();
    }

    public function contents(): HasMany
    {
        return $this->hasMany(Content::class);
    }

    public function contentTypes(): HasMany
    {
        return $this->hasMany(ContentType::class);
    }
}
