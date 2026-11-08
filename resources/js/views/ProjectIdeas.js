import { contentRequest } from '../services/contentRecovery';

export default {
    props: { projectId: { type: String, required: true }, folders: { type: Array, default: () => [] }, types: { type: Array, default: () => [] } },
    emits: ['open-content'],
    data: () => ({
        page: null, title: '', body: '', archive: false, view: 'kanban', query: '', busy: false, error: '',
        editing: null, conversion: null, columnFilter: '', columnDraft: null,
        columns: [],
    }),
    computed: {

        groups() {
            if (this.archive || this.view === 'list') return [['Idées', this.page?.data ?? []]];
            return this.columns.map(({ key, label }) => [label, (this.page?.data ?? []).filter(idea => idea.column_key === key)]);
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
            const params = new URLSearchParams({ archive: Number(this.archive), page, search: this.query, column: this.columnFilter });
            this.page = (await contentRequest(this.endpoint() + '?' + params)).data;
            this.columns = this.page.columns;
        },
        load(page) {
            return this.run(() => this.fetch(page));
        },
        editColumns() {
            this.columnDraft = this.columns.map(column => ({ ...column }));
        },
        addColumn() {
            this.columnDraft.push({ key: crypto.randomUUID().replaceAll('-', ''), label: '' });
        },
        moveColumn(index, offset) {
            const [column] = this.columnDraft.splice(index, 1);
            this.columnDraft.splice(index + offset, 0, column);
        },
        saveColumns() {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/columns', 'PUT', { columns: this.columnDraft });
                this.columnDraft = null;
                this.columnFilter = '';
                await this.fetch();
            });
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
