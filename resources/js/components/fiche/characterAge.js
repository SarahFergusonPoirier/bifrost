import { identityField } from './identitySection';

export function ageFromBirthDate(value, today = new Date()) {
    if (typeof value === 'string') value = { start: value, precision: 'exact' };
    if (value?.precision !== 'exact' || value.end) return null;
    const calendar = value.calendar?.trim().toLocaleLowerCase('fr');
    if (calendar && !['grégorien', 'gregorian'].includes(calendar)) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.start ?? '');
    if (!match) return null;

    const [, year, month, day] = match.map(Number);
    const birth = new Date(value.start + 'T00:00:00Z');
    if (birth.getUTCFullYear() !== year || birth.getUTCMonth() + 1 !== month || birth.getUTCDate() !== day) return null;

    const birthdayPassed = today.getMonth() + 1 > month
        || (today.getMonth() + 1 === month && today.getDate() >= day);
    const age = today.getFullYear() - year - Number(!birthdayPassed);
    return age >= 0 ? age : null;
}

export function birthDateField(sections, identityTitle) {
    const isBirthDate = field => (field.format === 'temporal' || field.column === 'value_date')
        && [field.field_definition.label, field.label_override].includes('Date de naissance');
    return identityField(sections, identityTitle, isBirthDate);
}
