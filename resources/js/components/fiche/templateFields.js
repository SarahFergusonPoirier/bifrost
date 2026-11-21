import { structuredFieldTypes } from './fieldTypes';

export const fieldColumns = {
    text: 'value_text', choice: 'value_text', number: 'value_number',
    boolean: 'value_boolean', date: 'value_date', json: 'value_json', reference: 'reference_content_id',
};
const legacySectionLabels = new Map(Object.entries({
    identity: 'Identité',
    description: 'Description',
    character: 'Personnalité',
    story: 'Parcours',
    intent: 'Intention',
    rules: 'Règles',
    notes: 'Notes',
    physical: 'Caractéristiques physiques',
    environment: 'Environnement',
    context: 'Contexte',
    details: 'Détails',
    history: 'Histoire',
    society: 'Société',
    biology: 'Biologie',
    purpose: 'Objectifs',
    structure: 'Structure',
    power: 'Influence',
    'daily-life': 'Vie quotidienne',
    expression: 'Expression culturelle',
    beliefs: 'Croyances',
    practice: 'Pratiques',
    usage: 'Usages',
    causes: 'Causes',
    events: 'Déroulement',
    impact: 'Conséquences',
    operation: 'Fonctionnement',
}));

export function templateSectionLabel(section, fields) {
    if (fields[0]?.blockTitle) return fields[0].blockTitle;
    if (fields.some(field => field.display_options?.section_label === section)) return section;
    return legacySectionLabels.get(section) ?? section;
}

export function groupContentFields(content) {
    const sections = groupTemplateFields(content?.template_assignment?.template_version?.fields ?? []);
    for (const block of content?.blocks ?? []) {
        if (block.block_type !== 'fields') continue;
        const fields = [...groupTemplateFields(block.fields ?? []).values()].flat()
            .map(field => ({ ...field, blockId: block.public_id, blockTitle: block.title || 'Champs indépendants' }));
        sections.set('block:' + block.public_id, fields);
    }
    return sections;
}

export function groupTemplateFields(fields) {
    const sections = new Map();
    for (const field of fields) {
        const column = fieldColumns[field.field_definition?.value_type];
        const format = field.field_definition?.options_data?.format;
        if (!column || (column === 'value_json' && !structuredFieldTypes.includes(format))) continue;
        const section = field.display_options?.section_label ?? field.section_key ?? 'Informations';
        if (!sections.has(section)) sections.set(section, []);
        const labels = [section, field.label_override, field.field_definition.label, ...(field.display_options?.section_aliases ?? [])];
        const richText = field.field_definition.value_type === 'text'
            && (format === 'rich_text' || field.section_key === 'story' || labels.some(label => label?.toLocaleLowerCase('fr') === 'biographie'));
        sections.get(section).push({ ...field, column, format, richText });
    }
    return sections;
}
