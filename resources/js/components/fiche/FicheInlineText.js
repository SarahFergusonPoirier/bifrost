import { inlineText } from './ficheTextFormat';

export default {
    props: { text: { type: String, required: true }, resolveReference: Function },
    emits: ['open'],
    computed: { parts() { return inlineText(this.text); } },
};
