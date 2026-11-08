<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Validator;

class ContentRelation extends Model
{
    use HasFactory;

    protected $fillable = ['source_content_id', 'target_content_id', 'type_key', 'properties_data'];

    protected function casts(): array
    {
        return ['properties_data' => 'array'];
    }

    protected static function booted(): void
    {
        static::saving(function (ContentRelation $relation): void {
            Validator::make($relation->attributesToArray(), [
                'source_content_id' => ['required', 'integer', 'exists:contents,id,deleted_at,NULL'],
                'target_content_id' => ['required', 'integer', 'different:source_content_id', 'exists:contents,id,deleted_at,NULL'],
                'type_key' => ['required', 'alpha_dash:ascii', 'max:80'],
                'properties_data' => ['nullable', 'array'],
            ])->validate();
        });
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'source_content_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'target_content_id');
    }
}
