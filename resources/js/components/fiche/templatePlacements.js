import { normalizeBlockSize } from './blockDimensions';

export function instantiateTemplatePlacements(placements, templateId, revision = 1) {
    const sources = new Map();
    const sourceId = slot => {
        if (!sources.has(slot)) sources.set(slot, crypto.randomUUID());
        return sources.get(slot);
    };
    return placements.map(({ field_bindings, ...placement }) => {
        const id = crypto.randomUUID();
        const result = { ...placement, id };
        if (placement.source.startsWith('blank-fields:')) {
            result.source = 'fields:' + sourceId(placement.source);
            result.newFields = { template_id: templateId, template_revision: revision, slot: placement.source };
        } else if (placement.source.startsWith('blank:')) {
            result.source = 'text:' + sourceId(placement.source);
            result.newText = true;
        }
        if (field_bindings?.length) result.newBindings = field_bindings.map(binding => ({
            id: sourceId(binding.slot), source: 'template-fields', template_id: templateId, template_revision: revision,
            slot: binding.slot, bind_to: [{ placement: id, fields: binding.fields }],
        }));
        return normalizeBlockSize(result);
    });
}

export function collectTemplateBindings(copies, bindings = []) {
    for (const copy of bindings) {
        const previous = copies.get(copy.id);
        copies.set(copy.id, { ...previous, ...copy, bind_to: [...(previous?.bind_to ?? []), ...copy.bind_to] });
    }
}

export function templateBindingFields(placement, definition) {
    return (placement?.field_bindings ?? []).flatMap(binding => (definition?.field_blocks?.[binding.slot]?.fields ?? [])
        .filter(field => binding.fields.some(item => item.slot === field.slot)).map(field => ({ ...field, bindingSlot: binding.slot })));
}
