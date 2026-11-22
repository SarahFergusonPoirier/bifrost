import StructuredField from '../StructuredField.vue';
import FicheTextEditor from './FicheTextEditor.vue';
import { fieldColumns } from './templateFields';
import { structuredFieldTypes } from './fieldTypes';

export default {
    components: { StructuredField, FicheTextEditor },
    props: {
        type: { type: String, required: true }, modelValue: Object, contentId: String,
        choices: { type: Array, default: () => [] }, levels: { type: Number, default: 5 },
        targets: { type: Array, default: () => [] }, referenceTypes: { type: Array, default: () => [] }, levelMode: String,
    },
    emits: ['update:modelValue'],
    computed: {
        column() { return fieldColumns[this.type] ?? (this.type === 'rich_text' ? 'value_text' : 'value_json'); },
        value() { return this.modelValue?.[this.column] ?? ''; },
        state() { return this.modelValue?.value_state ?? ''; },
        structured() { return structuredFieldTypes.includes(this.type) && this.type !== 'multiple_choice'; },
        allowedTargets() { return this.targets.filter(target => !this.referenceTypes.length || this.referenceTypes.includes(target.content_type_id)); },
    },
    methods: {
        update(value) { this.$emit('update:modelValue', value === '' || value == null ? null : { [this.column]: value }); },
        updateState(state) { this.$emit('update:modelValue', state ? { value_state: state } : null); },
        updateMultiple(event) {
            const values = [...event.target.selectedOptions].map(option => option.value);
            this.update(values.length ? values : '');
        },
    },
};
