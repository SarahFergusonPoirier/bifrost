import { expect, it } from 'vitest';
import { ageFromBirthDate } from '../../resources/js/components/fiche/characterAge';

it('calculates age only from an exact Gregorian date', () => {
    const birth = { start: '2000-06-15', precision: 'exact' };
    expect(ageFromBirthDate(birth, new Date(2026, 5, 14))).toBe(25);
    expect(ageFromBirthDate(birth, new Date(2026, 5, 15))).toBe(26);
    expect(ageFromBirthDate({ ...birth, precision: 'approximate' })).toBeNull();
    expect(ageFromBirthDate({ ...birth, calendar: 'Ère des brumes' })).toBeNull();
    expect(ageFromBirthDate({ ...birth, start: '2001-02-29' })).toBeNull();
    expect(ageFromBirthDate(birth, new Date(1999, 0, 1))).toBeNull();
});
