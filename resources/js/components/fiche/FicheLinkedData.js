import { contentRequest } from '../../services/contentRecovery';

export default {
    props: { path: { type: String, required: true }, kind: { type: String, required: true }, full: Boolean, hasTab: Boolean },
    emits: ['open', 'show-all'],
    data: () => ({ data: null, error: '', expanded: false, previewSize: 4 }),
    computed: {
        limit() {
            return this.full || this.expanded ? undefined : this.previewSize;
        },
        events() {
            return this.data.timeline.toSorted((a, b) => (a.date.start || '').localeCompare(b.date.start || '', 'fr', { numeric: true }));
        },
    },
    mounted() {
        this.load();
    },
    methods: {
        showAll() {
            if (this.hasTab) this.$emit('show-all', this.kind);
            else this.expanded = !this.expanded;
        },
        async load() {
            this.error = '';
            try {
                const { data } = await contentRequest(this.path);
                this.data = { relations: data?.relations ?? [], timeline: data?.timeline ?? [] };
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
