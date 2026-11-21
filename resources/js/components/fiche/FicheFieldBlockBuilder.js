import { fieldTypes } from './fieldTypes';

export default {
    props: { disabled: Boolean, referenceTypes: { type: Array, default: () => [] } },
    emits: ['create'],
    data: () => ({ title: '', fields: [] }),
    computed: {
        types() { return Object.fromEntries(Object.entries(fieldTypes).filter(([type]) => type !== 'json')); },
        valid() {
            return this.title.trim() && this.fields.length > 0 && this.fields.every(field => field.label.trim()
                && this.types[field.type] && (field.type !== 'scale' || Number.isInteger(Number(field.levels)) && Number(field.levels) >= 2 && Number(field.levels) <= 20));
        },
    },
    methods: {
        addField() {
            if (this.fields.length >= 200) return;
            this.fields.push({ id: crypto.randomUUID(), label: 'Champ ' + (this.fields.length + 1), type: 'text',
                help: '', required: false, history_view: 'current', choicesText: '', levels: '5', levelDescriptions: '',
                scale_display: 'both', badge_color: 'accent', repeatable_level_mode: 'text', reference_types: [], allow_reference_creation: false, calculation: 'none' });
        },
        move(index, offset) {
            const destination = index + offset;
            if (destination < 0 || destination >= this.fields.length) return;
            const [field] = this.fields.splice(index, 1);
            this.fields.splice(destination, 0, field);
        },
        create() {
            if (!this.valid || this.disabled) return;
            const title = this.title.trim();
            const fields = this.fields.map(field => ({
                label: field.label.trim(), type: field.type, section: title, help: field.help.trim() || null,
                required: field.required, history_view: field.history_view,
                ...(['choice', 'multiple_choice', 'capabilities'].includes(field.type) ? { choices: field.choicesText.split('\n').map(value => value.trim()).filter(Boolean) } : {}),
                ...(field.type === 'choice' ? { badge_color: field.badge_color } : {}),
                ...(field.type === 'repeatable' ? { repeatable_level_mode: field.repeatable_level_mode } : {}),
                ...(field.type === 'number' ? { calculation: field.calculation } : {}),
                ...(['reference', 'references'].includes(field.type) ? { reference_types: field.reference_types, allow_reference_creation: field.allow_reference_creation } : {}),
                ...(field.type === 'scale' ? { levels: Number(field.levels), scale_display: field.scale_display,
                    level_descriptions: field.levelDescriptions.split('\n').slice(0, Number(field.levels)).map(value => value.trim() || null) } : {}),
            }));
            this.$emit('create', { title, fields });
            this.reset();
        },
        reset() { this.title = ''; this.fields = []; },
    },
};
