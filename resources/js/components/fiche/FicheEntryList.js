import { defineAsyncComponent } from 'vue';
import FicheText from './FicheText.vue';
import FicheScale from './FicheScale.vue';
import FicheEntryFields from './FicheEntryFields.vue';
import ContentAttachments from '../ContentAttachments.vue';
import { formatTemporalDate } from './formatFieldValue';

export default {
    components: { FicheText, FicheScale, FicheEntryFields, ContentAttachments,
        FicheGroupValues: defineAsyncComponent(() => import('./FicheGroupValues.vue')) },
    props: {
        entries: { type: Array, default: () => [] }, schema: { type: Array, default: () => [] },
        levelMode: String, contentId: String, targets: { type: Array, default: () => [] },
        resolveReference: Function, textLimit: Number,
        parentFieldId: Number, historyPath: { type: Array, default: () => [] },
    },
    emits: ['open'],
    methods: { formatTemporalDate },
};
