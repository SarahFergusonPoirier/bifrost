export default {
    props: { targets: { type: Array, required: true } },
    emits: ['insert'],
    data: () => ({ selected: '' }),
    methods: {
        insert() {
            if (!this.targets.some(target => target.public_id === this.selected)) return;
            this.$emit('insert', this.selected);
        },
    },
};
