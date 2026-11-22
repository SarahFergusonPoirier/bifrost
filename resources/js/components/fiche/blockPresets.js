import presets from '../../../../config/fiche-block-presets.json';
import { matchesFicheSearch } from './ficheSearch';

export function matchingBlockPresets(query = '') {
    return presets.filter(preset => matchesFicheSearch(query, preset.title, ...preset.fields.map(field => field.label)));
}
