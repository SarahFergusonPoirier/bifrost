import { contentRequest } from '../services/contentRecovery';

export default {
    props: { projectId: { type: String, required: true }, folders: { type: Array, default: () => [] }, types: { type: Array, default: () => [] } },
    emits: ['open-content'],
    data: () => ({
        page: null, title: '', body: '', archive: false, view: 'kanban', query: '', busy: false, error: '',
        editing: null, conversion: null,
        columns: { new: 'Nouvelles', develop: 'À développer', retained: 'Retenues', abandoned: 'Abandonnées' },
    }),
    computed: {
        visible() {
            const query = this.query.trim().toLocaleLowerCase('fr');
            return (this.page?.data ?? []).filter(idea => [idea.title ?? '', idea.body]
                .some(value => value.toLocaleLowerCase('fr').includes(query)));
        },
        groups() {
            if (this.archive || this.view === 'list') return [['Idées', this.visible]];
            return Object.entries(this.columns).map(([key, label]) => [label, this.visible.filter(idea => idea.column_key === key)]);
        },
    },
    mounted() {
        this.load();
    },
    methods: {
        endpoint() {
            return '/projects/' + this.projectId + '/ideas';
        },
        async run(action) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try { await action(); } catch (error) { this.error = error.message; } finally { this.busy = false; }
        },
        async fetch(page = 1) {
            this.page = (await contentRequest(this.endpoint() + '?archive=' + Number(this.archive) + '&page=' + page)).data;
        },
        load(page) {
            return this.run(() => this.fetch(page));
        },
        capture() {
            return this.run(async () => {
                await contentRequest(this.endpoint(), 'POST', { title: this.title || null, body: this.body });
                this.title = '';
                this.body = '';
                await this.fetch();
            });
        },
        edit(idea) {
            this.editing = { id: idea.id, title: idea.title ?? '', body: idea.body, folder_ids: [...idea.folder_ids] };
        },
        saveEdit() {
            return this.change(this.editing.id, {
                title: this.editing.title || null, body: this.editing.body, folder_ids: this.editing.folder_ids,
            }, true);
        },
        change(id, patch, closeEditor = false) {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/' + id, 'PATCH', patch);
                if (closeEditor || Object.hasOwn(patch, 'archived') && this.editing?.id === id) this.editing = null;
                await this.fetch(this.page?.current_page);
            });
        },
        beginConversion(idea) {
            this.conversion = { id: idea.id, title: idea.title ?? '', content_type_id: '', request_id: crypto.randomUUID() };
        },
        convert() {
            return this.run(async () => {
                const { id, ...payload } = this.conversion;
                await contentRequest(this.endpoint() + '/' + id + '/convert', 'POST', payload);
                this.conversion = null;
                await this.fetch(this.page?.current_page);
            });
        },
    },
};
