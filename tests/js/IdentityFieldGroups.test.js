import { expect, it } from 'vitest';
import { identityPreset } from '../../resources/js/views/identityFieldCatalog';

it.each([
    ['Anciens noms', 'Nom', [['Période', 'temporal'], ['Motif', 'text']]],
    ['Titres honorifiques', 'Titre', [['Période', 'temporal']]],
    ['Nationalité', 'Nationalité ou citoyenneté', [['Fiche liée', 'reference'], ['Période', 'temporal']]],
    ['Langues parlées', 'Langue', [['Niveau', 'text'], ['Remarques', 'rich_text']]],
])('provides the typed identity group %s with independent member identities', (label, entryLabel, members) => {
    const first = identityPreset(label);
    const second = identityPreset(label);
    expect(first).toMatchObject({ type: 'repeatable', entry_label: entryLabel });
    expect(first.entry_fields.map(field => [field.label, field.type])).toEqual(members);
    const keys = first.entry_fields.map(field => field.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some(key => second.entry_fields.some(field => field.key === key))).toBe(false);
    expect(first.entry_fields.every(field => !field.required)).toBe(true);
});
