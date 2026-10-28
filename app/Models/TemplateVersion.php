<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

class TemplateVersion extends Model
{
    protected $fillable = ['template_id', 'version_number', 'change_summary', 'published_at'];

    protected function casts(): array
    {
        return ['version_number' => 'integer', 'published_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(function (TemplateVersion $version): void {
            if ($version->getOriginal('published_at') !== null) {
                throw new LogicException('Une version publiée de modèle est immuable.');
            }
        });

        static::deleting(function (TemplateVersion $version): void {
            if ($version->published_at !== null) {
                throw new LogicException('Une version publiée de modèle ne peut pas être supprimée.');
            }
        });
    }

    public function template(): BelongsTo { return $this->belongsTo(ContentTemplate::class, 'template_id'); }
    public function fields(): HasMany { return $this->hasMany(TemplateVersionField::class, 'template_version_id')->orderBy('position'); }
    public function assignments(): HasMany { return $this->hasMany(ContentTemplateAssignment::class, 'template_version_id'); }
}