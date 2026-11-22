import { contentRequest } from '../../services/contentRecovery';

export default {
    props: { projectId: String, full: Boolean, types: { type: Array, required: true } },
    emits: ['created'],
    data: () => ({ title: '', typeId: null, busy: false, error: '' }),
    methods: {
        async create() {
            if (this.busy || this.full || !this.title || !this.types.some(type => type.id === this.typeId)) return;
            this.busy = true;
            this.error = '';
            try {
                const { data } = await contentRequest('/contents', 'POST', {
                    title: this.title, content_type_id: this.typeId, project_id: this.projectId,
                });
                this.$emit('created', data);
                this.title = '';
            } catch (failure) {
                this.error = failure.message;
            } finally {
                this.busy = false;
            }
        },
    },
};
