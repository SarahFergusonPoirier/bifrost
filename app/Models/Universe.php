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
