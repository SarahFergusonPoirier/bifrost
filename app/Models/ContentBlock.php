<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ContentBlock extends Model
{
    use SoftDeletes;

    protected $fillable = ['content_id', 'block_type', 'title', 'body', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    protected static function booted(): void
    {
        static::creating(function ($block): void {
            $block->public_id = $block->public_id ?: (string) Str::uuid();
        });
    }

    public function content(): BelongsTo
    {
        return $this->belongsTo(Content::class);
    }
}
