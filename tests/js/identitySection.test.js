import { expect, it } from 'vitest';
import { identityField, identitySectionTitle } from '../../resources/js/components/fiche/identitySection';

it('uses the original identity label after renaming and handles ambiguous aliases', () => {
    const renamedField = { display_options: { section_aliases: ['Identité', 'État civil'] } };
    const sections = new Map([['Informations personnelles', [renamedField]]]);

    expect(identitySectionTitle(sections)).toBe('Informations personnelles');

    sections.set('Biographie', [renamedField]);
    expect(identitySectionTitle(sections)).toBeUndefined();

    sections.set('Identité', [{}]);
    expect(identitySectionTitle(sections)).toBe('Identité');
});

it('prefers identity fields from a legacy section over duplicates elsewhere', () => {
    const firstName = { id: 1, label: 'Prénom' };
    const otherFirstName = { id: 2, label: 'Prénom' };
    const sections = new Map([
        ['identity', [firstName]],
        ['Famille', [otherFirstName]],
    ]);

    const title = identitySectionTitle(sections);
    expect(title).toBe('identity');
    expect(identityField(sections, title, field => field.label === 'Prénom')).toBe(firstName);

    sections.set('État civil', [{ display_options: { section_aliases: ['Identité'] } }]);
    expect(identitySectionTitle(sections)).toBe('État civil');
});
