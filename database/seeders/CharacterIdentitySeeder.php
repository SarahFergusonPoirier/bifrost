<?php

namespace Database\Seeders;

use App\Models\ContentTemplate;
use App\Models\FieldDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CharacterIdentitySeeder extends Seeder
{
    public const RELEASE = 'Bloc Identité du personnage.';

    public function run(): void
    {
        DB::transaction(function (): void {
            $template = ContentTemplate::query()->where('is_system', true)->where('scope_type', 'global')
                ->whereHas('contentType', fn ($query) => $query->where('key', 'personnage'))
                ->lockForUpdate()->first();
            $previous = $template?->versions()->where('version_number', 1)->first();
            if (! $previous || $template->versions()->where('change_summary', self::RELEASE)->exists()) {
                return;
            }

            $version = $template->versions()->create([
                'version_number' => (int) $template->versions()->reorder()->max('version_number') + 1, 'change_summary' => self::RELEASE,
            ]);
            $identity = [
                ['character-age', 'Âge', 'number', null, []],
                ['character-gender', 'Genre', 'text', null, []],
                ['character-vital-status', 'Statut vital', 'choice', null, ['choices' => ['Vivant', 'Décédé', 'Disparu'], 'badge_color' => 'accent']],
                ['character-narrative-role', 'Rôle narratif', 'json', ['format' => 'multiple_choice'], [
                    'choices' => ['Protagoniste', 'Deutéragoniste', 'Principal', 'Secondaire', 'Tertiaire', 'Antagoniste', 'Héros', 'Antihéros', 'Anti-vilain', 'Figurant'],
                ]],
            ];
            foreach ($identity as $position => [$key, $label, $type, $options, $display]) {
                $definition = FieldDefinition::firstOrCreate(['key' => $key, 'scope_type' => 'global'], [
                    'label' => $label, 'value_type' => $type, 'options_data' => $options,
                ]);
                $version->fields()->create([
                    'field_definition_id' => $definition->id, 'section_key' => 'identity', 'position' => $position,
                    'display_options' => ['section_label' => 'Identité'] + $display,
                ]);
            }

            foreach ($previous->fields as $field) {
                $copy = $field->replicate();
                $copy->position += count($identity);
                if ($copy->section_key === 'identity') {
                    $copy->section_key = 'details';
                }
                $version->fields()->save($copy);
            }

            $version->update(['published_at' => now()]);
        }, attempts: 3);
    }
}
