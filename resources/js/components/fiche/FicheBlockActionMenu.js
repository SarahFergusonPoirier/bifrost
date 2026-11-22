export default {
    props: { title: { type: String, required: true } },
    mounted() { document.addEventListener('pointerdown', this.closeOutside); },
    beforeUnmount() { document.removeEventListener('pointerdown', this.closeOutside); },
    methods: {
        close(restoreFocus = false) {
            if (!this.$refs.disclosure?.open) return;
            this.$refs.disclosure.open = false;
            if (restoreFocus) this.$refs.trigger.focus();
        },
        closeOutside(event) {
            if (!this.$el.contains(event.target)) this.close();
        },
        activate(event) {
            if (event.target.closest('button:not(:disabled), a[href]')) this.close();
        },
    },
};
