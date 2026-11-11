import { useId } from 'vue';
import { contentRequest } from '../services/contentRecovery';

export default {
    props: {
        format: { type: String, required: true },
        value: { type: [Object, Array], default: null },
        levels: { type: Number, default: 5 },
        contentId: String,
        levelMode: String,
        categoryOptions: { type: Array, default: () => [] },
        targets: { type: Array, default: () => [] },
    },
    emits: ['change'],
    data: () => ({ keyword: '', images: [], imageError: '' }),
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
        addKeyword() {
            const label = this.keyword.trim();
            const entries = this.value ?? [];
            if (!label || entries.length >= 100) return;
            this.setKeywords([...entries, { label}]);
            this.keyword = '';
        },
        editKeyword(index, key, text) {
            const value = text.trim();
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
            entries.splice(index + 1, 0, { ...entries[index], ...(this.format === 'repeatable' ? { id: undefined } : {}) });
            this.setKeywords(entries);
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
