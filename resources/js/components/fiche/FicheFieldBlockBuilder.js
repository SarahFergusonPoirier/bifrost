import { fieldTypes } from './fieldTypes';
import FicheDefaultValueEditor from './FicheDefaultValueEditor.vue';
import { fieldSchemaSpec, previewEntryFields } from './fieldSchemaSpecs';

export default {
    components: { FicheDefaultValueEditor },
    props: { disabled: Boolean, schema: Object, groupMode: Boolean, depth: { type: Number, default: 0 }, contentId: String, targets: { type: Array, default: () => [] }, referenceTypes: { type: Array, default: () => [] } },
    emits: ['create', 'update', 'pending'],
    data: () => ({ title: '', fields: [] }),
    computed: {
        types() { return Object.fromEntries(Object.entries(fieldTypes).filter(([type]) => type !== 'json' && (this.depth < 3 || type !== 'repeatable'))); },
        limit() { return this.groupMode ? 20 : 200; },
        valid() {
            return this.title.trim() && (this.groupMode || this.fields.length > 0) && this.fields.every(field => field.label.trim()
                && this.types[field.type] && !field.groupPending && (!field.default_enabled || field.default_value != null)
                && (field.type !== 'scale' || Number.isInteger(Number(field.levels)) && Number(field.levels) >= 2 && Number(field.levels) <= 20
                    && (!(field.existingId || field.existingKey) || Number(field.levels) === field.originalLevels || field.preserveScale)));
        },
    },
    watch: { schema: { immediate: true, handler(schema) { if (schema) this.loadSchema(schema); } } },
    methods: {
        newField() {
            return { id: crypto.randomUUID(), key: crypto.randomUUID(), entry_fields: [], groupPending: false, groupEditor: { title: 'Champs du groupe', fields: [], pendingFields: [] }, label: 'Champ ' + (this.fields.length + 1), type: 'text',
                help: '', required: false, history_view: 'current', default_enabled: false, default_value: null, choicesText: '', levels: '5', levelDescriptions: '', originalLevels: 5, preserveScale: false,
                scale_display: 'both', badge_color: 'accent', repeatable_level_mode: 'text', reference_types: [], allow_reference_creation: false, calculation: 'none' };
        },
        loadSchema(schema) {
            this.title = schema.title || 'Champs';
            const originals = new Map(schema.fields.map(field => [field.field_definition_id, field]));
            const memberOriginals = new Map(schema.fields.filter(field => field.key).map(field => [field.key, field]));
            const entries = schema.pendingFields ?? schema.fields.filter(field => !field.retired).map(fieldSchemaSpec);
            this.fields = entries.map(field => {
                const original = this.groupMode ? memberOriginals.get(field.key) : originals.get(field.id);
                const children = original?.display_options?.entry_fields ?? original?.field_definition.options_data?.entry_fields ?? [];
                return { ...this.newField(), ...field, id: crypto.randomUUID(), existingId: field.id,
                    existingKey: this.groupMode && original ? field.key : null,
                    entry_fields: field.entry_fields ?? [], groupEditor: { title: 'Champs du groupe', fields: children, pendingFields: field.entry_fields ?? [] },
                    help: field.help || '', required: Boolean(field.required), default_enabled: field.default_value != null,
                    choicesText: (field.choices ?? []).join('\n'), levelDescriptions: (field.level_descriptions ?? []).join('\n'),
                    levels: String(field.levels ?? 5), originalLevels: original?.display_options?.scale_levels ?? original?.field_definition.options_data?.levels ?? 5,
                    preserveScale: field.scale_strategy === 'preserve', reference_types: field.reference_types ?? [],
                    default_value: field.default_value == null ? null : JSON.parse(JSON.stringify(field.default_value)),
                    history_view: field.history_view ?? 'current', scale_display: field.scale_display ?? 'both', badge_color: field.badge_color ?? '',
                    repeatable_level_mode: field.repeatable_level_mode ?? 'text', calculation: field.calculation ?? 'none', allow_reference_creation: Boolean(field.allow_reference_creation),
                };
            });
        },
        addField() {
            if (this.fields.length >= this.limit) return;
            this.fields.push(this.newField());
            this.$emit('pending', true);
        },
        move(index, offset) {
            const destination = index + offset;
            if (destination < 0 || destination >= this.fields.length) return;
            const [field] = this.fields.splice(index, 1);
            this.fields.splice(destination, 0, field);
            this.$emit('pending', true);
        },
        create() {
            if (!this.valid || this.disabled) return;
            const title = this.title.trim();
            const fields = this.fields.map(field => ({
                label: field.label.trim(), type: field.type, section: title, help: field.help.trim() || null,
                ...(field.existingId ? { id: field.existingId } : {}),
                ...(this.groupMode ? { key: field.key } : {}),
                ...(field.type === 'repeatable' ? { entry_fields: field.entry_fields } : {}),
                required: field.required, history_view: field.history_view,
                ...(field.default_enabled ? { default_value: field.default_value } : this.schema ? { default_value: null } : {}),
                ...(['choice', 'multiple_choice', 'capabilities'].includes(field.type) ? { choices: field.choicesText.split('\n').map(value => value.trim()).filter(Boolean) } : {}),
                ...(field.type === 'choice' ? { badge_color: field.badge_color } : {}),
                ...(field.type === 'repeatable' ? { repeatable_level_mode: field.repeatable_level_mode } : {}),
                ...(field.type === 'number' ? { calculation: field.calculation } : {}),
                ...(['reference', 'references'].includes(field.type) ? { reference_types: field.reference_types, allow_reference_creation: field.allow_reference_creation } : {}),
                ...(field.type === 'scale' ? { levels: Number(field.levels), scale_display: field.scale_display,
                    ...(field.preserveScale ? { scale_strategy: 'preserve' } : {}),
                    level_descriptions: field.levelDescriptions.split('\n').slice(0, Number(field.levels)).map(value => value.trim() || null) } : {}),
            }));
            this.$emit(this.schema ? 'update' : 'create', { title, fields });
            this.reset();
        },
        reset() {
            if (this.schema) this.loadSchema(this.schema);
            else { this.title = ''; this.fields = []; }
            this.$emit('pending', false);
        },
        previewEntryFields,
        setGroupFields(field, fields) {
            field.entry_fields = fields;
            field.groupEditor = { ...field.groupEditor, pendingFields: fields };
            field.groupPending = false;
            this.$emit('pending', true);
        },
        removeField(index) { this.fields.splice(index, 1); this.$emit('pending', true); },
    },
};
