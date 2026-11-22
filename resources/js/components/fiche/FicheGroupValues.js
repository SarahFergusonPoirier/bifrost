import FicheValueEditor from './FicheValueEditor.vue';
import FicheText from './FicheText.vue';
import FicheScale from './FicheScale.vue';
import FicheEntryList from './FicheEntryList.vue';
import ContentAttachments from '../ContentAttachments.vue';
import { fieldColumns } from './templateFields';
import { formatFieldValue } from './formatFieldValue';

export default {
    components: { FicheValueEditor, FicheText, FicheScale, FicheEntryList, ContentAttachments },
    props: {
        schema: { type: Array, default: () => [] }, values: { type: Object, default: () => ({}) },
        editable: Boolean, contentId: String, targets: { type: Array, default: () => [] },
        projectId: String, contentTypes: { type: Array, default: () => [] },
        resolveReference: Function, textLimit: Number,
    },
    emits: ['change', 'open', 'reference-created'],
    methods: {
        type(field) { return field.field_definition.options_data?.format || field.field_definition.value_type; },
        value(field) { return this.values[field.key]?.[fieldColumns[field.field_definition.value_type]]; },
        state(field) { return this.values[field.key]?.value_state; },
        references(field) {
            const value = this.value(field);
            const many = this.type(field) === 'references';
            return (many ? value ?? [] : value == null ? [] : [value]).map(id => {
                const target = this.targets.find(target => many ? target.public_id === id : target.id === Number(id));
                return { id, target };
            });
        },
        formatted(field) {
            return formatFieldValue({ ...field, column: fieldColumns[field.field_definition.value_type], format: this.type(field) },
                this.value(field), this.state(field), () => this.references(field).map(reference => ({ title: reference.target?.title ?? 'Fiche indisponible' })));
        },
        update(field, value) {
            const next = { ...this.values };
            if (value == null) delete next[field.key];
            else next[field.key] = value;
            this.$emit('change', next);
        },
        safeUrl(url) { return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null; },
    },
};
