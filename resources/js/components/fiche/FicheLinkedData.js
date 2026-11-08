import { contentRequest } from '../../services/contentRecovery';
import FicheBlock from './FicheBlock.vue';

export default {
    components: { FicheBlock },
    props: { path: { type: String, required: true }, kind: { type: String, required: true } },
    emits: ['open'],
    data: () => ({ data: null, error: '' }),
    computed: {
        events() {
            return this.data.timeline.toSorted((a, b) => (a.date.start || '').localeCompare(b.date.start || '', 'fr', { numeric: true }));
        },
    },
    mounted() {
        this.load();
    },
    methods: {
        async load() {
            this.error = '';
            try {
                this.data = (await contentRequest(this.path)).data;
            } catch (error) {
                this.error = error.message;
            }
        },
        formatDate(date) {
            const value = [date.start, date.end, date.calendar].filter(Boolean).join(' · ');
            if (!value) return 'Date inconnue';
            return date.precision === 'approximate' ? 'Vers ' + value : value;
        },
    },
};
