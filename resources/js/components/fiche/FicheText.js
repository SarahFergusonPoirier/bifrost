import FicheInlineText from './FicheInlineText.vue';
import { textBlocks, textPreview } from './ficheTextFormat';

export default {
    components: { FicheInlineText },
    props: {
        text: { type: String, required: true }, limit: { type: Number, default: 320 }, resolveReference: Function,
    },
    emits: ['open'],
    data: () => ({ expanded: false }),
    computed: {
        canTruncate() { return this.limit > 0 && this.text.length > this.limit; },
        truncated() { return !this.expanded && this.canTruncate; },
        blocks() { return textBlocks(this.truncated ? textPreview(this.text, this.limit) : this.text); },
    },
};
