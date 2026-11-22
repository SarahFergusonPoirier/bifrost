<?php

namespace Database\Seeders;

use App\Models\ContentTemplate;
use App\Models\FieldDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CharacterBlocksSeeder extends Seeder
{
    public const RELEASE = 'Blocs Attributs clés et Personnalité du personnage, sans doublon hérité.';

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
                if ($field->section_key === 'character') {
                    continue;
                }
                $version->fields()->save($field->replicate());
                $position = max($position, $field->position + 1);
            }

            $presets = json_decode(file_get_contents(config_path('fiche-block-presets.json')), true, flags: JSON_THROW_ON_ERROR);
            foreach ($presets as $preset) {
                $section = $preset['key'];
                if (! in_array($section, ['attributes', 'personality'], true)) {
                    continue;
                }
                foreach ($preset['fields'] as $field) {
                    $label = $field['label'];
                    $format = $field['type'];
                    $definition = FieldDefinition::firstOrCreate([
                        'key' => 'character-'.$section.'-'.Str::slug($label), 'scope_type' => 'global',
                    ], [
                        'label' => $label,
                        'value_type' => 'json',
                        'options_data' => ['format' => $format] + ($format === 'scale' ? ['levels' => $field['levels']] : []),
                    ]);
                    $version->fields()->create([
                        'field_definition_id' => $definition->id,
                        'section_key' => $section,
                        'position' => $position++,
                        'display_options' => ['section_label' => $preset['title']],
                    ]);
                }
            }

            $version->update(['published_at' => now()]);
        }, attempts: 3);
    }
}
