<?php

namespace App;

use Illuminate\Validation\ValidationException;

class FicheBlockDimensions
{
    private static ?array $rules = null;

    public static function forSource(string $source): array
    {
        self::$rules ??= json_decode(file_get_contents(config_path('fiche-block-dimensions.json')), true, flags: JSON_THROW_ON_ERROR);
        $prefix = explode(':', $source, 2)[0];
        $kind = match ($prefix) {
            'section', 'blank-fields' => 'fields',
            'blank' => 'text',
            default => $prefix,
        };

        return array_replace(self::$rules['default'], self::$rules['types'][$kind] ?? []);
    }

    public static function validate(array $tabs, array $previousTabs): void
    {
        $previous = collect($previousTabs)->flatMap(fn (array $tab): array => $tab['placements'] ?? [])->keyBy('id');
        $errors = [];
        foreach ($tabs as $tabIndex => $tab) {
            foreach ($tab['placements'] ?? [] as $index => $placement) {
                $limits = self::forSource($placement['source']);
                $old = $previous->get($placement['id']);
                foreach (['width' => 'Width', 'height' => 'Height'] as $dimension => $axis) {
                    $value = (int) $placement[$dimension];
                    if ($value >= $limits['min'.$axis] && $value <= $limits['max'.$axis]) {
                        continue;
                    }
                    if ($old && $old['source'] === $placement['source'] && (int) $old[$dimension] === $value) {
                        continue;
                    }
                    $errors["tabs.$tabIndex.placements.$index.$dimension"] = 'Ce type de bloc exige une dimension entre '.$limits['min'.$axis].' et '.$limits['max'.$axis].'.';
                }
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
