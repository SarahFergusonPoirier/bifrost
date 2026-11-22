import { fieldTypes } from './fieldTypes';
import FicheDefaultValueEditor from './FicheDefaultValueEditor.vue';

export default {
    components: { FicheDefaultValueEditor },
    props: { disabled: Boolean, schema: Object, contentId: String, targets: { type: Array, default: () => [] }, referenceTypes: { type: Array, default: () => [] } },
    emits: ['create', 'update'],
    data: () => ({ title: '', fields: [] }),
    computed: {
        types() { return Object.fromEntries(Object.entries(fieldTypes).filter(([type]) => type !== 'json')); },
        valid() {
            return this.title.trim() && this.fields.length > 0 && this.fields.every(field => field.label.trim()
                && this.types[field.type] && (!field.default_enabled || field.default_value != null)
                && (field.type !== 'scale' || Number.isInteger(Number(field.levels)) && Number(field.levels) >= 2 && Number(field.levels) <= 20
                    && (!field.existingId || Number(field.levels) === field.originalLevels || field.preserveScale)));
        },
    },
    watch: { schema: { immediate: true, handler(schema) { if (schema) this.loadSchema(schema); } } },
    methods: {
        newField() {
            return { id: crypto.randomUUID(), label: 'Champ ' + (this.fields.length + 1), type: 'text',
                help: '', required: false, history_view: 'current', default_enabled: false, default_value: null, choicesText: '', levels: '5', levelDescriptions: '', originalLevels: 5, preserveScale: false,
                scale_display: 'both', badge_color: 'accent', repeatable_level_mode: 'text', reference_types: [], allow_reference_creation: false, calculation: 'none' };
        },
        loadSchema(schema) {
            this.title = schema.title || 'Champs';
            const originals = new Map(schema.fields.map(field => [field.field_definition_id, field]));
            const entries = schema.pendingFields ?? schema.fields.map(field => ({
                id: field.field_definition_id, label: field.label_override || field.field_definition.label,
                type: field.field_definition.options_data?.format || field.field_definition.value_type,
                help: field.help_text, required: field.is_required, default_value: field.default_value,
                choices: field.display_options?.choices ?? field.field_definition.options_data?.choices,
                levels: field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5,
                level_descriptions: field.display_options?.level_descriptions, scale_display: field.display_options?.scale_display,
                badge_color: field.display_options?.badge_color, history_view: field.display_options?.history_view,
                repeatable_level_mode: field.display_options?.repeatable_level_mode, calculation: field.display_options?.calculation,
                reference_types: field.field_definition.options_data?.content_type_ids, allow_reference_creation: field.display_options?.allow_reference_creation,
            }));
            this.fields = entries.map(field => {
                const original = originals.get(field.id);
                return { ...this.newField(), ...field, id: crypto.randomUUID(), existingId: field.id,
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
            if (this.fields.length >= 200) return;
            this.fields.push(this.newField());
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
                ...(field.existingId ? { id: field.existingId } : {}),
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
        reset() { if (this.schema) this.loadSchema(this.schema); else { this.title = ''; this.fields = []; } },
    },
};
