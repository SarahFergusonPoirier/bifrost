<?php

namespace Database\Seeders;

use App\Models\ContentTemplate;
use App\Models\ContentType;
use App\Models\FieldDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EncyclopedicCatalogSeeder extends Seeder
{
    public const RELEASE = 'Catalogue encyclopédique Bifrost 1';

    public function run(): void
    {
        $catalog = json_decode(file_get_contents(__DIR__.'/encyclopedic-catalog.json'), true, flags: JSON_THROW_ON_ERROR);

        foreach ($catalog as [$name, $key, $sections]) {
            DB::transaction(fn () => $this->publish($name, $key, $sections), attempts: 3);
        }
    }

    private function publish(string $name, string $key, array $sections): void
    {
        $type = ContentType::firstOrCreate(
            ['key' => $key, 'scope_type' => 'system'],
            ['name' => $name, 'is_system' => true],
        );
        $template = ContentTemplate::firstOrCreate(
            ['name' => $name, 'content_type_id' => $type->id, 'scope_type' => 'global', 'is_system' => true],
            ['is_active' => true],
        );
        $template = ContentTemplate::whereKey($template->id)->lockForUpdate()->firstOrFail();

        if ($template->versions()->where('change_summary', self::RELEASE)->exists()) {
            return;
        }

        $version = $template->versions()->create([
            'version_number' => (int) $template->versions()->reorder()->max('version_number') + 1,
            'change_summary' => self::RELEASE,
        ]);
        $position = 0;

        foreach ($sections as $section => $fields) {
            $sectionKey = Str::slug($section);
            foreach ($fields as $field) {
                $format = $this->format($field);
                $definition = FieldDefinition::firstOrCreate(
                    ['scope_type' => 'global', 'key' => 'encyclopedia.'.$key.'.'.$sectionKey.'.'.Str::slug($field)],
                    ['label' => Str::ucfirst($field), 'value_type' => $format ? 'json' : 'text',
                        'options_data' => $format ? ['format' => $format] : null],
                );
                $version->fields()->create([
                    'field_definition_id' => $definition->id,
                    'section_key' => $sectionKey,
                    'position' => $position++,
                    'display_options' => ['section_label' => $section],
                ]);
            }
        }

        $version->update(['published_at' => now()]);
    }

    private function format(string $field): ?string
    {
        return match (true) {
            str_contains($field, 'calcul') => 'calculation',
            str_contains($field, 'unités') => 'measurement',
            str_contains($field, 'coordonnées') => 'coordinates',
            str_contains($field, 'référence') => 'references',
            preg_match('/^(date|début|fin|période|repère relatif)|\(date\)/u', $field) === 1 => 'temporal',
            default => null,
        };
    }
}
