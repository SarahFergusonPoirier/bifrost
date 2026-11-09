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

it('preserves approximate dates in field display', () => {
    const field = { format: 'temporal' };
    expect(formatFieldValue(field, { start: 'An 498', precision: 'approximate' })).toBe('Vers An 498');
    expect(formatFieldValue(field, { start: 'An 498', end: 'An 500' })).toBe('An 498 · An 500');
});

it('keeps older list snapshots readable when their shape differs', () => {
    const field = { format: 'bullets' };
    expect(formatFieldValue(field, null)).toBe('—');
    expect(formatFieldValue(field, ['Ancienne entrée', { label: 'Nouvelle entrée' }])).toBe('Ancienne entrée, Nouvelle entrée');
    expect(formatFieldValue(field, { label: 'Entrée unique' })).toBe('{"label":"Entrée unique"}');
});
