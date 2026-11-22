import FicheValueEditor from './FicheValueEditor.vue';

export default {
    components: { FicheValueEditor },
    props: FicheValueEditor.props,
    emits: ['update:modelValue', 'reference-created'],
};
