export function fieldSchemaSpec(field) {
    const definition = field.field_definition ?? {};
    const options = definition.options_data ?? {};
    const display = field.display_options ?? {};
    return {
        ...(field.field_definition_id ? { id: field.field_definition_id } : {}),
        ...(field.key ? { key: field.key } : {}),
        label: field.label_override || definition.label, type: options.format || definition.value_type,
        help: field.help_text, required: field.is_required, default_value: field.default_value,
        choices: display.choices ?? options.choices, levels: display.scale_levels ?? options.levels ?? 5,
        level_descriptions: display.level_descriptions, scale_display: display.scale_display,
        badge_color: display.badge_color, history_view: display.history_view,
        hide_empty: display.hide_empty ?? null,
        repeatable_level_mode: display.repeatable_level_mode, calculation: display.calculation,
        reference_types: options.content_type_ids, allow_reference_creation: display.allow_reference_creation,
        entry_fields: (display.entry_fields ?? options.entry_fields ?? []).filter(field => !field.retired).map(fieldSchemaSpec),
    };
}

export function previewEntryFields(fields) {
    return fields.map(field => ({
        key: field.key,
        field_definition: {
            label: field.label,
            value_type: ['text', 'number', 'boolean', 'date', 'choice', 'reference'].includes(field.type) ? field.type : field.type === 'rich_text' ? 'text' : 'json',
            options_data: { format: field.type, levels: field.levels, content_type_ids: field.reference_types,
                entry_fields: previewEntryFields(field.entry_fields ?? []) },
        },
        display_options: { choices: field.choices, repeatable_level_mode: field.repeatable_level_mode },
        is_required: field.required, help_text: field.help, default_value: field.default_value,
    }));
}
