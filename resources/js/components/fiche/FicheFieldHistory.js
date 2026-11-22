import { contentRequest } from '../../services/contentRecovery';
import { fieldHistoryValue, fieldHistorySignature } from './fieldHistoryValue';

export default {
    props: {
        contentId: { type: String, required: true },
        field: { type: Object, required: true },
        formatValue: { type: Function, required: true },
        parentFieldId: Number,
        path: { type: Array, default: () => [] },
    },
    data: () => ({ page: 0, lastPage: 0, entries: [], busy: false, error: '' }),
    computed: {
        historyKey() { return JSON.stringify([this.contentId, this.parentFieldId ?? this.field.field_definition_id, this.path]); },
    },
    watch: {
        historyKey() { this.page = 0; this.lastPage = 0; this.entries = []; this.busy = false; this.error = ''; },
    },
    methods: {
        async load() {
            if (this.busy || (this.page && this.page >= this.lastPage)) return;
            this.busy = true;
            this.error = '';
            const historyKey = this.historyKey;
            try {
                const { data } = await contentRequest('/contents/' + encodeURIComponent(this.contentId) + '/revisions?page=' + (this.page + 1));
                if (historyKey !== this.historyKey) return;
                for (const revision of data.data) {
                    if (!revision.snapshot.field_values) continue;
                    const parent = revision.snapshot.field_values.find(item => item.field_definition_id === (this.parentFieldId ?? this.field.field_definition_id));
                    const value = fieldHistoryValue(parent, this.path);
                    const label = this.formatValue(this.field, value);
                    const signature = fieldHistorySignature(value);
                    if (this.entries.at(-1)?.signature !== signature) this.entries.push({ id: revision.id, date: revision.created_at, value: label, payload: value, signature });
                }
                this.page = data.current_page;
                this.lastPage = data.last_page;
            } catch (error) {
                if (historyKey === this.historyKey) this.error = error.message;
            } finally {
                if (historyKey === this.historyKey) this.busy = false;
            }
        },
    },
};
