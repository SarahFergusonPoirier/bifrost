export default {
    props: {
        format: { type: String, required: true },
        value: { type: [Object, Array], default: null },
        levels: { type: Number, default: 5 },
        targets: { type: Array, default: () => [] },
    },
    emits: ['change'],
    methods: {
        update(key, value) {
            const next = { ...this.value };
            if (value === '') delete next[key];
            else next[key] = value;
            this.$emit('change', Object.keys(next).length ? next : '');
        },
        updateReferences(event) {
            const selected = [...event.target.selectedOptions].map(option => option.value);
            this.$emit('change', selected.length ? selected : '');
        },
    },
};
