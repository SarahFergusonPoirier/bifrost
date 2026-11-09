import { expect, it } from 'vitest';
import { ageFromBirthDate, birthDateField } from '../../resources/js/components/fiche/characterAge';

it('calculates age only from an exact Gregorian date', () => {
    const birth = { start: '2000-06-15', precision: 'exact' };
    expect(ageFromBirthDate(birth, new Date(2026, 5, 14))).toBe(25);
    expect(ageFromBirthDate(birth, new Date(2026, 5, 15))).toBe(26);
    expect(ageFromBirthDate({ ...birth, precision: 'approximate' })).toBeNull();
    expect(ageFromBirthDate({ ...birth, calendar: 'Ère des brumes' })).toBeNull();
    expect(ageFromBirthDate({ ...birth, start: '2001-02-29' })).toBeNull();
    expect(ageFromBirthDate(birth, new Date(1999, 0, 1))).toBeNull();
});

it('finds a moved birth date without guessing between duplicate sources', () => {
    const birth = { format: 'temporal', field_definition: { label: 'Date de naissance' } };
    const duplicate = { ...birth };
    const sections = new Map([['Biographie', [birth]]]);

    expect(birthDateField(sections, 'Identité')).toBe(birth);

    sections.set('Archives', [duplicate]);
    expect(birthDateField(sections, 'Identité')).toBeUndefined();

    sections.set('Identité', [duplicate]);
    expect(birthDateField(sections, 'Identité')).toBe(duplicate);
});

it('accepts a native date field as the birth date', () => {
    const field = { column: 'value_date', field_definition: { label: 'Date de naissance' } };
    expect(birthDateField(new Map([['Identité', [field]]]), 'Identité')).toBe(field);
    expect(ageFromBirthDate('2000-06-15', new Date(2026, 5, 15))).toBe(26);
    expect(ageFromBirthDate('2001-02-29')).toBeNull();
});

it('recognizes a birth date named on the template field', () => {
    const field = {
        column: 'value_date',
        field_definition: { label: 'Date' },
        label_override: 'Date de naissance',
    };
    expect(birthDateField(new Map([['Identité', [field]]]), 'Identité')).toBe(field);
});
