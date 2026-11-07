<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

class ContentTemplateAssignment extends Model
{
    protected $fillable = ['content_id', 'template_id', 'template_version_id', 'assigned_at'];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::saving(function (ContentTemplateAssignment $assignment): void {
            $content = Content::query()->find($assignment->content_id);
            $template = ContentTemplate::query()->find($assignment->template_id);
            $version = TemplateVersion::query()->find($assignment->template_version_id);

            if (! $content || ! $template || ! $version
                || (string) $version->template_id !== (string) $template->id
                || $version->published_at === null) {
                throw ValidationException::withMessages([
                    'template_version_id' => 'L’affectation exige une version publiée appartenant au modèle choisi.',
                ]);
            }

            $scopeCompatible = $template->scope_type === 'global'
                || ($template->scope_type === 'project' && $content->scope_type === 'project'
                    && (string) $template->project_id === (string) $content->project_id)
                || ($template->scope_type === 'universe' && $content->scope_type === 'universe'
                    && (string) $template->universe_id === (string) $content->universe_id);

            if (! $scopeCompatible || (string) $template->content_type_id !== (string) $content->content_type_id) {
                throw ValidationException::withMessages([
                    'template_id' => 'Le modèle doit correspondre au type et à la portée du contenu.',
                ]);
            }

            $assignment->assigned_at ??= now();
        });
    }

    public function content(): BelongsTo { return $this->belongsTo(Content::class); }
    public function template(): BelongsTo { return $this->belongsTo(ContentTemplate::class, 'template_id'); }
    public function templateVersion(): BelongsTo { return $this->belongsTo(TemplateVersion::class, 'template_version_id'); }
}