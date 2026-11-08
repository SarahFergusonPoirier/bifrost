export default {
    props: {
        format: { type: String, required: true },
        value: { type: [Object, Array], default: null },
        levels: { type: Number, default: 5 },
        targets: { type: Array, default: () => [] },
    },
    emits: ['change'],
    data: () => ({ keyword: '' }),
    methods: {
        update(key, value) {
            const next = { ...this.value };
            if (value === '') delete next[key];
            else next[key] = value;
            this.$emit('change', Object.keys(next).length ? next : '');
        },
        setKeywords(entries) {
            this.$emit('change', entries.length ? entries : '');
        },
        addKeyword() {
            const label = this.keyword.trim();
            const entries = this.value ?? [];
            if (!label || entries.length >= 100) return;
            this.setKeywords([...entries, { label }]);
            this.keyword = '';
        },
        editKeyword(index, key, text) {
            const value = text.trim();
            if (key === 'label' && !value) return;
            this.setKeywords(this.value.map((entry, i) => i === index ? { ...entry, [key]: value || null } : entry));
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
