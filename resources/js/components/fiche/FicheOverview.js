import FicheBlock from './FicheBlock.vue';
import FicheText from './FicheText.vue';

export default {
    components: { FicheBlock, FicheText },
    props: {
        summary: String,
        tags: { type: Array, default: () => [] },
        blocks: { type: Array, default: () => [] },
        templateSections: { type: Map, required: true },
        hiddenFields: { type: Array, required: true },
        displayValue: { type: Function, required: true },
    },
    computed: {
        sections() {
            return Array.from(this.templateSections, ([title, fields]) => ({
                title,
                fields: fields.filter(field => !this.hiddenFields.includes(field.field_definition_id)).map(field => ({
                    id: field.id,
                    label: field.label_override || field.field_definition.label,
                    value: this.displayValue(field),
                })),
            })).filter(section => section.fields.length);
        },
        textBlocks() {
            return this.blocks.filter(block => typeof block.body === 'string' && block.body.trim());
        },
    },
};
