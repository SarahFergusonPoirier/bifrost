export const fieldColumns = {
    text: 'value_text', choice: 'value_text', number: 'value_number',
    boolean: 'value_boolean', date: 'value_date', json: 'value_json', reference: 'reference_content_id',
};
export function groupTemplateFields(fields) {
    const sections = new Map();
    for (const field of fields) {
        const column = fieldColumns[field.field_definition?.value_type];
        const format = field.field_definition?.options_data?.format;
        if (!column || (column === 'value_json' && !['measurement', 'coordinates', 'temporal', 'references', 'multiple_choice', 'scale', 'keywords', 'equipment', 'capabilities', 'repeatable', 'bullets', 'external_link'].includes(format))) continue;
        const section = field.display_options?.section_label ?? field.section_key ?? 'Informations';
        if (!sections.has(section)) sections.set(section, []);
        sections.get(section).push({ ...field, column, format });
    }
    return sections;
}
