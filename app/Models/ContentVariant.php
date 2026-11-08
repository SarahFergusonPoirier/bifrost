<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

class ContentVariant extends Model
{
    protected $fillable = ['base_content_id', 'project_id', 'title_override', 'summary_override'];

    protected static function booted(): void
    {
        static::saving(function (ContentVariant $variant): void {
            $base = Content::find($variant->base_content_id);
            $project = Project::find($variant->project_id);

            if (! $base || ! $project || ! match ($base->scope_type) {
                'global' => true,
                'universe' => $project->universes()->whereKey($base->universe_id)->exists(),
                default => false,
            }) {
                throw ValidationException::withMessages([
                    'base_content_id' => 'Le contenu partagé doit être accessible au projet.',
                ]);
            }
        });
    }

    public function baseContent(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'base_content_id');
    }

    public function resolvedTitle(): ?string
    {
        return $this->title_override ?? $this->baseContent?->title;
    }

    public function resolvedSummary(): ?string
    {
        return $this->summary_override ?? $this->baseContent?->summary;
    }
}
