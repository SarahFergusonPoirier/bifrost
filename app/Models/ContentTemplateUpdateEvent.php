<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class ContentTemplateUpdateEvent extends Model
{
    protected $fillable = [
        'content_id', 'template_id', 'from_template_version_id',
        'to_template_version_id', 'applied_at', 'change_details',
    ];

    protected function casts(): array
    {
        return ['applied_at' => 'datetime', 'change_details' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (ContentTemplateUpdateEvent $event): void {
            $event->applied_at ??= now();
        });

        static::updating(function (): void {
            throw new LogicException('L’historique des mises à jour de modèle est immuable.');
        });

        static::deleting(function (): void {
            throw new LogicException('L’historique des mises à jour de modèle ne peut pas être supprimé.');
        });
    }

    public function content(): BelongsTo { return $this->belongsTo(Content::class); }
    public function template(): BelongsTo { return $this->belongsTo(ContentTemplate::class, 'template_id'); }
    public function fromVersion(): BelongsTo { return $this->belongsTo(TemplateVersion::class, 'from_template_version_id'); }
    public function toVersion(): BelongsTo { return $this->belongsTo(TemplateVersion::class, 'to_template_version_id'); }
}