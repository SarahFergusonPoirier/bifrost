import FicheReferencePicker from './FicheReferencePicker.vue';

export default {
    components: { FicheReferencePicker },
    props: {
        label: { type: String, required: true },
        modelValue: String,
        maxLength: Number,
        targets: { type: Array, default: () => [] },
    },
    emits: ['update:modelValue'],
    methods: {
        replaceSelection(text, start, end, selectionStart, selectionEnd) {
            const editor = this.$refs.editor;
            if (this.maxLength && editor.value.length - (end - start) + text.length > this.maxLength) return;
            editor.setRangeText(text, start, end, 'end');
            this.$emit('update:modelValue', editor.value);
            editor.focus();
            editor.setSelectionRange(selectionStart, selectionEnd);
        },
        updateText(text) {
            if (!this.maxLength || text.length <= this.maxLength) this.$emit('update:modelValue', text);
        },
        insertReference(id) {
            const { value, selectionStart: start, selectionEnd: end } = this.$refs.editor;
            const label = value.slice(start, end);
            const canUseLabel = label && !/[\]\r\n]/.test(label);
            const marker = canUseLabel
                ? '[[' + id + '|' + label + ']]'
                : '[[' + id + ']]';
            const replaceEnd = canUseLabel ? end : start;
            const cursor = start + marker.length;
            this.replaceSelection(marker, start, replaceEnd, cursor, cursor);
        },
        bold() {
            const { value, selectionStart: start, selectionEnd: end } = this.$refs.editor;
            const selection = value.slice(start, end);
            if (selection.includes('\n')) return;
            this.replaceSelection('**' + selection + '**', start, end, start + 2, end + 2);
        },
        prefixLines(prefix) {
            const { value, selectionStart, selectionEnd } = this.$refs.editor;
            const start = value.slice(0, selectionStart).lastIndexOf('\n') + 1;
            const nextLine = value.indexOf('\n', Math.max(selectionStart, selectionEnd - 1));
            const end = nextLine === -1 ? value.length : nextLine;
            const replacement = value.slice(start, end).split('\n').map(line => prefix + line).join('\n');
            this.replaceSelection(replacement, start, end, start + replacement.length, start + replacement.length);
        },
    },
};
