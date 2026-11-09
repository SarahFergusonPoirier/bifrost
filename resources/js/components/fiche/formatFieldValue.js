export function formatFieldValue(field, value, state, fieldReferences) {
    if (state) return state === 'unknown' ? 'Inconnu' : 'Non applicable';
    if (value === '') return '—';
    if (field.column === 'value_date' && typeof value === 'string') {
        return /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value)?.[1] ?? value;
    }
    if (field.column === 'reference_content_id' || field.format === 'references') {
        return fieldReferences(field, value).map(item => item.title).join(', ') || '—';
    }
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (field.format === 'external_link') return value.label || value.url;
    if (['keywords', 'equipment', 'capabilities', 'repeatable', 'bullets'].includes(field.format)) return value.map(keyword => keyword.label).join(', ');
    if (field.format === 'scale') {
        const levels = field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5;
        return value.level > levels ? value.level + ' (valeur conservée, maximum actuel : ' + levels + ')' : value.level + ' / ' + levels;
    }
    if (field.format === 'measurement') return [value.amount, value.unit].filter(part => part != null).join(' ');
    if (field.format === 'coordinates') return [value.x, value.y].filter(part => part != null).join(' · ');
    if (field.format === 'temporal') return formatTemporalDate(value);
    if (field.format === 'multiple_choice') return value.join(', ');
    return value;
}

export function formatTemporalDate(date, emptyLabel = 'Date inconnue') {
    const value = [date?.start, date?.end, date?.calendar].filter(Boolean).join(' · ');
    if (!value) return emptyLabel;
    return date.precision === 'approximate' ? 'Vers ' + value : value;
}
