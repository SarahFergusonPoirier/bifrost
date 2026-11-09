import { expect, it } from 'vitest';
import { formatFieldValue } from '../../resources/js/components/fiche/formatFieldValue';

it('shows a stored native date without its serialization time', () => {
    const field = { column: 'value_date' };
    expect(formatFieldValue(field, '2026-11-08T00:00:00.000000Z')).toBe('2026-11-08');
    expect(formatFieldValue(field, '2026-11-08')).toBe('2026-11-08');
    expect(formatFieldValue(field, '', 'unknown')).toBe('Inconnu');
    expect(formatFieldValue(field, '', 'not_applicable')).toBe('Non applicable');
    expect(formatFieldValue(field, '')).toBe('—');
});
