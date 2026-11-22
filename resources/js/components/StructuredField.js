import { defineAsyncComponent, useId } from 'vue';
import { contentRequest } from '../services/contentRecovery';
import FicheTextEditor from './fiche/FicheTextEditor.vue';
import FicheEntryFields from './fiche/FicheEntryFields.vue';

export default {
    components: { FicheTextEditor, FicheEntryFields, FicheGroupValues: defineAsyncComponent(() => import('./fiche/FicheGroupValues.vue')) },
    props: {
        format: { type: String, required: true },
        value: { type: [Object, Array], default: null },
        levels: { type: Number, default: 5 },
        contentId: String,
        levelMode: String,
        entryFields: { type: Array, default: () => [] },
        categoryOptions: { type: Array, default: () => [] },
        targets: { type: Array, default: () => [] },
    },
    emits: ['change'],
    data: () => ({ keyword: '', images: [], imageError: '', attachments: [], attachmentError: '' }),
    setup() {
        return { categoryListId: useId() };
    },
    computed: {
        abilityCategories() {
            if (this.format !== 'capabilities') return [];
            return [...new Set([...this.categoryOptions, ...(this.value ?? []).map(entry => entry.category)].filter(Boolean))];
        },
    },
    methods: {
        update(key, value) {
            const next = { ...this.value };
            if (value === '') delete next[key];
            else next[key] = value;
            this.$emit('change', Object.keys(next).length ? next : '');
        },
        async loadImages() {
            if (!this.contentId) return;
            this.imageError = '';
            try {
                const { data } = await contentRequest('/contents/' + encodeURIComponent(this.contentId) + '/attachments?images=1');
                this.images = data;
            } catch (error) {
                this.imageError = error.message;
            }
        },
        setKeywords(entries) {
            const values = this.format === 'repeatable'
                ? entries.map(entry => entry.id ? entry : { ...entry, id: crypto.randomUUID() })
                : entries;
            this.$emit('change', values.length ? values : '');
        },
        async loadAttachments() {
            if (!this.contentId) return;
            this.attachmentError = '';
            try {
                const { data } = await contentRequest('/contents/' + encodeURIComponent(this.contentId) + '/attachments');
                this.attachments = data;
            } catch (error) {
                this.attachmentError = error.message;
            }
        },
        addKeyword() {
            const label = this.keyword.trim();
            const entries = this.value ?? [];
            if (!label || entries.length >= 100) return;
            const defaults = Object.fromEntries(this.entryFields.filter(field => !field.retired && field.default_value != null)
                .map(field => [field.key, JSON.parse(JSON.stringify(field.default_value))]));
            this.setKeywords([...entries, { label, ...(this.format === 'repeatable' && Object.keys(defaults).length ? { values: defaults } : {}) }]);
            this.keyword = '';
        },
        editKeyword(index, key, text, trim = true) {
            const value = trim ? text.trim() : text;
            if (key === 'label' && !value) return;
            this.setKeywords(this.value.map((entry, i) => i === index ? { ...entry, [key]: value ? (['mastery', 'rank'].includes(key) ? Number(value) : value) : null } : entry));
        },
        setRepeatableDate(index, date) {
            const entries = this.value.map((entry, position) => {
                if (position !== index) return entry;
                const { date: previousDate, ...fields } = entry;
                return date ? { ...fields, date } : fields;
            });
            this.setKeywords(entries);
        },
        duplicateEntry(index) {
            if (this.value.length >= 100) return;
            const entries = [...this.value];
            const copy = JSON.parse(JSON.stringify(entries[index]));
            if (copy.fields) copy.fields = copy.fields.map(field => ({ ...field, id: crypto.randomUUID() }));
            entries.splice(index + 1, 0, { ...copy, ...(this.format === 'repeatable' ? { id: undefined } : {}) });
            this.setKeywords(entries);
        },
        setEntryFields(index, fields) {
            this.setKeywords(this.value.map((entry, position) => position === index ? { ...entry, fields } : entry));
        },
        setGroupValues(index, values) {
            this.setKeywords(this.value.map((entry, position) => position === index ? { ...entry, values } : entry));
        },
        moveKeyword(index, offset) {
            const entries = [...this.value];
            const [entry] = entries.splice(index, 1);
            entries.splice(index + offset, 0, entry);
            this.setKeywords(entries);
        },
        updateReferences(event) {
            const selected = [...event.target.selectedOptions].map(option => option.value);
            this.$emit('change', selected.length ? selected : '');
        },
    },
};
