<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class Resource extends Model
{
    use HasFactory;

    protected $attributes = ['scope_type' => 'global'];

    protected $fillable = [
        'original_name', 'storage_mode', 'location', 'scope_type', 'project_id', 'universe_id', 'metadata',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (Resource $resource): void {
            $resource->public_id = (string) Str::uuid();
        });

        static::saving(function (Resource $resource): void {
            Validator::make($resource->attributesToArray(), [
                'original_name' => ['required', 'string', 'max:255'],
                'storage_mode' => ['required', 'in:imported,external'],
                'location' => ['required', 'string'],
                'scope_type' => ['required', 'in:global,project,universe'],
                'project_id' => ['nullable', 'required_if:scope_type,project', 'prohibited_unless:scope_type,project', 'integer', 'exists:projects,id'],
                'universe_id' => ['nullable', 'required_if:scope_type,universe', 'prohibited_unless:scope_type,universe', 'integer', 'exists:universes,id'],
                'metadata' => ['nullable', 'array'],
            ])->validate();
        });
    }

    public function contents(): BelongsToMany
    {
        return $this->belongsToMany(Content::class);
    }
}
