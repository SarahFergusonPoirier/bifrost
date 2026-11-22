import FicheValueEditor from './FicheValueEditor.vue';
import FicheText from './FicheText.vue';
import FicheScale from './FicheScale.vue';
import FicheEntryList from './FicheEntryList.vue';
import FicheFieldHistory from './FicheFieldHistory.vue';
import ContentAttachments from '../ContentAttachments.vue';
import { fieldColumns } from './templateFields';
import { formatFieldValue } from './formatFieldValue';

export default {
    components: { FicheValueEditor, FicheText, FicheScale, FicheEntryList, FicheFieldHistory, ContentAttachments },
    props: {
        schema: { type: Array, default: () => [] }, values: { type: Object, default: () => ({}) },
        editable: Boolean, contentId: String, targets: { type: Array, default: () => [] },
        projectId: String, contentTypes: { type: Array, default: () => [] },
        parentFieldId: Number, historyPath: { type: Array, default: () => [] },
        hideEmpty: Boolean,
        resolveReference: Function, textLimit: Number,
    },
    emits: ['change', 'open', 'reference-created'],
    computed: {
        visibleFields() { return this.schema.filter(field => !(field.display_options?.hide_empty ?? this.hideEmpty) || !this.isEmpty(field)); },
    },
    methods: {
        isEmpty(field) {
            if (this.state(field)) return false;
            const value = this.value(field);
            return value == null || value === '' || Array.isArray(value) && !value.length;
        },
        type(field) { return field.field_definition.options_data?.format || field.field_definition.value_type; },
        value(field) { return this.values[field.key]?.[fieldColumns[field.field_definition.value_type]]; },
        state(field) { return this.values[field.key]?.value_state; },
        references(field) {
            return this.referenceItems(field, this.value(field));
        },
        referenceItems(field, value) {
            const many = this.type(field) === 'references';
            return (many ? value ?? [] : value == null ? [] : [value]).map(id => {
                const target = this.targets.find(target => many ? target.public_id === id : target.id === Number(id));
                return { id, target };
            });
        },
        formatted(field) {
            return this.formatPayload(field, this.values[field.key]);
        },
        formatPayload(field, payload) {
            return formatFieldValue({ ...field, column: fieldColumns[field.field_definition.value_type], format: this.type(field) },
                payload?.[fieldColumns[field.field_definition.value_type]], payload?.value_state,
                (_, value) => this.referenceItems(field, value).map(reference => ({ title: reference.target?.title ?? 'Fiche indisponible' })));
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
