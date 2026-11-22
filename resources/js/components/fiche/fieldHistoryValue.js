export function fieldHistoryValue(value, path) {
    let current = value;
    for (const step of path) {
        if (step.entry != null) current = Array.isArray(current?.value_json) ? current.value_json.find(entry => entry.id === step.entry) : undefined;
        else if (step.member != null) current = current?.values?.[step.member];
        if (current == null) return undefined;
    }
    return current;
}

export function fieldHistorySignature(value) {
    return JSON.stringify(['value_text', 'value_number', 'value_boolean', 'value_date', 'value_json', 'reference_content_id', 'value_state', 'date_options']
        .map(column => value?.[column] ?? null));
}
