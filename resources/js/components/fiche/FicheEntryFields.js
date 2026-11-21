import FicheText from './FicheText.vue';
import FicheTextEditor from './FicheTextEditor.vue';

export default {
    components: { FicheText, FicheTextEditor },
    props: {
        fields: { type: Array, default: () => [] },
        editable: Boolean,
        targets: { type: Array, default: () => [] },
        resolveReference: Function,
        textLimit: Number,
    },
    emits: ['change', 'open'],
    methods: {
        add() {
            if (this.fields.length >= 20) return;
            this.$emit('change', [...this.fields, { id: crypto.randomUUID(), label: 'Champ complémentaire', value: '' }]);
        },
        update(id, key, value) {
            this.$emit('change', this.fields.map(field => field.id === id ? { ...field, [key]: value } : field));
        },
        remove(id) {
            this.$emit('change', this.fields.filter(field => field.id !== id));
        },
        move(index, offset) {
            const destination = index + offset;
            if (destination < 0 || destination >= this.fields.length) return;
            const fields = [...this.fields];
            const [field] = fields.splice(index, 1);
            fields.splice(destination, 0, field);
            this.$emit('change', fields);
        },
    },
};
