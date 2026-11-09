import { expect, it } from 'vitest';
import { identitySectionTitle } from '../../resources/js/components/fiche/identitySection';

it('uses the original identity label after renaming and handles ambiguous aliases', () => {
    const renamedField = { display_options: { section_aliases: ['Identité', 'État civil'] } };
    const sections = new Map([['Informations personnelles', [renamedField]]]);

    expect(identitySectionTitle(sections)).toBe('Informations personnelles');

    sections.set('Biographie', [renamedField]);
    expect(identitySectionTitle(sections)).toBeUndefined();

    sections.set('Identité', [{}]);
    expect(identitySectionTitle(sections)).toBe('Identité');
});
