export default {
    props: { label: { type: String, default: 'Date' }, modelValue: Object },
    emits: ['update:modelValue'],
    methods: {
        updateDate(value) {
            this.$emit('update:modelValue', value ? { value_date: value, ...(this.modelValue?.date_options ? { date_options: { ...this.modelValue.date_options } } : {}) } : null);
        },
        updateOption(key, value) {
            if (!this.modelValue?.value_date) return;
            this.$emit('update:modelValue', { value_date: this.modelValue.value_date.slice(0, 10), date_options: { ...this.modelValue.date_options, [key]: value } });
        },
    },
};
