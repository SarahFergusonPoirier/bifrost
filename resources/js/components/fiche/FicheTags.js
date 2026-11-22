import { useId } from 'vue';

export default {
    props: {
        tags: { type: Array, required: true }, label: { type: String, required: true }, limit: { type: Number, default: 0 },
    },
    setup: () => ({ listId: useId() }),
    data: () => ({ expanded: false }),
    computed: {
        limited() { return this.limit > 0 && this.tags.length > this.limit; },
        visible() { return this.limited && !this.expanded ? this.tags.slice(0, this.limit) : this.tags; },
    },
};
