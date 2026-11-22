import StructuredField from '../StructuredField.vue';
import FicheTextEditor from './FicheTextEditor.vue';
import FicheReferenceCreate from './FicheReferenceCreate.vue';
import { fieldColumns } from './templateFields';
import { structuredFieldTypes } from './fieldTypes';

export default {
    components: { StructuredField, FicheTextEditor, FicheReferenceCreate },
    props: {
        label: { type: String, default: 'Valeur' },
        projectId: String, allowReferenceCreation: Boolean, contentTypes: { type: Array, default: () => [] },
        entryFields: { type: Array, default: () => [] },
        entryLabel: String,
        type: { type: String, required: true }, modelValue: Object, contentId: String,
        choices: { type: Array, default: () => [] }, levels: { type: Number, default: 5 },
        targets: { type: Array, default: () => [] }, referenceTypes: { type: Array, default: () => [] }, levelMode: String,
    },
    emits: ['update:modelValue', 'reference-created'],
    data: () => ({ createdTargets: [] }),
    watch: { projectId() { this.createdTargets = []; } },
    computed: {
        column() { return fieldColumns[this.type] ?? (this.type === 'rich_text' ? 'value_text' : 'value_json'); },
        value() { return this.modelValue?.[this.column] ?? ''; },
        state() { return this.modelValue?.value_state ?? ''; },
        retainedChoices() {
            const selected = Array.isArray(this.value) ? this.value : [this.value];
            return selected.filter(choice => typeof choice === 'string' && choice !== '' && !this.choices.includes(choice));
        },
        structured() { return structuredFieldTypes.includes(this.type) && this.type !== 'multiple_choice'; },
        allowedTargets() {
            return [...this.targets, ...this.createdTargets.filter(target => !this.targets.some(item => item.public_id === target.public_id))]
                .filter(target => !this.referenceTypes.length || this.referenceTypes.some(id => Number(id) === Number(target.content_type_id)));
        },
        creationTypes() { return this.contentTypes.filter(type => !this.referenceTypes.length || this.referenceTypes.some(id => Number(id) === Number(type.id))); },
        referenceFull() { return this.type === 'references' && Array.isArray(this.value) && this.value.length >= 200; },
    },
    methods: {
        update(value) { this.$emit('update:modelValue', value === '' || value == null ? null : { [this.column]: value }); },
        updateState(state) { this.$emit('update:modelValue', state ? { value_state: state } : null); },
        updateMultiple(event) {
            const values = [...event.target.selectedOptions].map(option => option.value);
            this.update(values.length ? values : '');
        },
        useCreatedReference(content) {
            if (!this.allowReferenceCreation || !['reference', 'references'].includes(this.type) || !this.projectId || Number(content.project_id) !== Number(this.projectId)
                || !this.creationTypes.some(type => Number(type.id) === Number(content.content_type_id))) return;
            this.createdTargets = [...this.createdTargets.filter(target => target.public_id !== content.public_id), content];
            this.$emit('reference-created', content);
            if (this.referenceFull) return;
            this.update(this.type === 'references' ? [...new Set([...(Array.isArray(this.value) ? this.value : []), content.public_id])] : content.id);
        },
    },
};
