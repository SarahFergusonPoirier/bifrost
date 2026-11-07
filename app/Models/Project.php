<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $fillable = ['name', 'description', 'cover_image', 'is_favorite'];

    protected function casts(): array
    {
        return ['is_favorite' => 'boolean'];
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class)->withTimestamps();
    }

    public function universes(): BelongsToMany
    {
        return $this->belongsToMany(Universe::class)->withPivot('usage_type')->withTimestamps();
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
