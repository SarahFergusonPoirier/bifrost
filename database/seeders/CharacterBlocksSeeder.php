<?php

namespace Database\Seeders;

use App\Models\ContentTemplate;
use App\Models\FieldDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CharacterBlocksSeeder extends Seeder
{
    public const RELEASE = 'Blocs Attributs clés et Personnalité du personnage.';

    public function run(): void
    {
        DB::transaction(function (): void {
            $template = ContentTemplate::query()->where('is_system', true)->where('scope_type', 'global')
                ->whereHas('contentType', fn ($query) => $query->where('key', 'personnage'))
                ->lockForUpdate()->first();
            $previous = $template?->versions()->where('change_summary', CharacterIdentitySeeder::RELEASE)->first();
            if (! $previous || $template->versions()->where('change_summary', self::RELEASE)->exists()) {
                return;
            }

            $version = $template->versions()->create([
                'version_number' => (int) $template->versions()->reorder()->max('version_number') + 1,
                'change_summary' => self::RELEASE,
            ]);
            $position = 0;
            foreach ($previous->fields as $field) {
                $version->fields()->save($field->replicate());
                $position = max($position, $field->position + 1);
            }

            $blocks = [
                ['attributes', 'Attributs clés', 'scale', ['Force', 'Agilité', 'Intelligence', 'Endurance', 'Charisme']],
                ['personality', 'Personnalité', 'keywords', ['Traits', 'Qualités', 'Défauts', 'Valeurs', 'Peurs']],
            ];
            foreach ($blocks as [$section, $title, $format, $labels]) {
                foreach ($labels as $label) {
                    $definition = FieldDefinition::firstOrCreate([
                        'key' => 'character-'.$section.'-'.Str::slug($label), 'scope_type' => 'global',
                    ], [
                        'label' => $label,
                        'value_type' => 'json',
                        'options_data' => ['format' => $format] + ($format === 'scale' ? ['levels' => 5] : []),
                    ]);
                    $version->fields()->create([
                        'field_definition_id' => $definition->id,
                        'section_key' => $section,
                        'position' => $position++,
                        'display_options' => ['section_label' => $title],
                    ]);
                }
            }

            $version->update(['published_at' => now()]);
        }, attempts: 3);
    }
}
