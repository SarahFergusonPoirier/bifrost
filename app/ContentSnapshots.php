<?php

namespace App;

use App\Models\Content;
use Illuminate\Support\Facades\DB;

class ContentSnapshots
{
    public static function data(Content $content, array $attributes): array
    {
        return [
            'title' => $attributes['title'], 'summary' => $attributes['summary'] ?? null, 'work_status_key' => $attributes['work_status_key'],
            'tag_ids' => $content->tags()->orderBy('tags.id')->pluck('tags.id')->all(),
            'blocks' => $content->blocks()->reorder()->orderBy('position')->orderBy('id')->get([
                'public_id', 'block_type', 'title', 'body', 'position', 'created_at', 'field_schema',
            ])->map(fn ($block): array => $block->getAttributes())->all(),
            'field_values' => $content->fieldValues()->orderBy('field_definition_id')->get([
                'field_definition_id', 'value_text', 'value_number', 'value_boolean', 'value_date', 'value_json', 'reference_content_id', 'value_state', 'date_options', 'created_at',
            ])->map(function ($value): array {
                $attributes = $value->getAttributes();
                if ($attributes['value_state'] === null) {
                    unset($attributes['value_state']);
                }

                return $attributes;
            })->all(),
        ];
    }

    public static function store(Content $content, array $snapshot, array $metadata = []): int
    {
        return DB::table('content_revisions')->insertGetId([
            'content_id' => $content->id, 'label' => $metadata['label'] ?? null, 'note' => $metadata['note'] ?? null,
            'snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'created_at' => now(),
        ]);
    }
}
