import { contentRequest } from '../services/contentRecovery';

const emptyEvent = () => ({
    title: '', description: '', precision: 'unknown', start: '', end: '', calendar: '', importance: 'unspecified',
});

export default {
    props: { projectId: { type: String, required: true } },
    emits: ['open-content'],
    data: () => ({
        source: null, events: null, precision: '', form: emptyEvent(), editing: null, error: '', busy: false,
        precisions: { exact: 'Exacte', approximate: 'Approximative', range: 'Période', relative: 'Relative', unknown: 'Inconnue' },
    }),
    mounted() {
        this.load();
    },
    methods: {
        endpoint() {
            return '/projects/' + this.projectId + '/timeline';
        },
        async run(action) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try {
                await action();
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
        async fetchPages(sourcePage = 1, eventPage = 1) {
            const filter = this.precision ? '&precision=' + this.precision : '';
            const [source, events] = await Promise.all([
                contentRequest(this.endpoint() + '?page=' + sourcePage + filter),
                contentRequest(this.endpoint() + '/events?page=' + eventPage + filter),
            ]);
            this.source = source.data;
            this.events = events.data;
        },
        load(sourcePage, eventPage) {
            return this.run(() => this.fetchPages(sourcePage, eventPage));
        },
        edit(event) {
            this.editing = event.id;
            this.form = Object.fromEntries(Object.keys(emptyEvent()).map(key => [key, event[key] ?? '']));
        },
        reset() {
            this.form = emptyEvent();
            this.editing = null;
        },
        save() {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/events' + (this.editing ? '/' + this.editing : ''),
                    this.editing ? 'PUT' : 'POST', this.form);
                this.reset();
                await this.fetchPages();
            });
        },
        remove(id) {
            if (!window.confirm('Retirer cet événement de la chronologie ?')) return;
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/events/' + id, 'DELETE');
                if (this.editing === id) this.reset();
                await this.fetchPages();
            });
        },
        dateLabel(date) {
            return [date.start, date.end, date.calendar].filter(Boolean).join(' · ')
                || this.precisions[date.precision] || 'Date inconnue';
        },
    },
};
