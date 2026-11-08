import { contentRequest } from '../../services/contentRecovery';

export default {
    props: {
        contentId: { type: String, required: true },
        field: { type: Object, required: true },
        formatValue: { type: Function, required: true },
    },
    data: () => ({ page: 0, lastPage: 0, entries: [], busy: false, error: '' }),
    methods: {
        async load() {
            if (this.busy || (this.page && this.page >= this.lastPage)) return;
            this.busy = true;
            this.error = '';
            try {
                const { data } = await contentRequest('/contents/' + encodeURIComponent(this.contentId) + '/revisions?page=' + (this.page + 1));
                for (const revision of data.data) {
                    if (!revision.snapshot.field_values) continue;
                    const value = revision.snapshot.field_values.find(item => item.field_definition_id === this.field.field_definition_id);
                    const label = this.formatValue(this.field, value);
                    if (this.entries.at(-1)?.value !== label) this.entries.push({ id: revision.id, date: revision.created_at, value: label });
                }
                this.page = data.current_page;
                this.lastPage = data.last_page;
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
    },
};
