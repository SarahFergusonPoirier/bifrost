import { contentRequest } from '../services/contentRecovery';

export default {
    props: { contentId: { type: String, required: true } },
    data: () => ({ attachments: [], busy: false, error: '' }),
    methods: {
        endpoint() {
            return '/contents/' + encodeURIComponent(this.contentId) + '/attachments';
        },
        download(id) {
            return '/api' + this.endpoint() + '/' + encodeURIComponent(id);
        },
        async run(action) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try {
                await action();
                this.attachments = (await contentRequest(this.endpoint())).data;
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
        upload() {
            return this.run(async () => {
                const input = this.$refs.file;
                const data = new FormData();
                data.set('file', input.files[0]);
                await contentRequest(this.endpoint(), 'POST', data);
                input.value = '';
            });
        },
        remove(attachment) {
            if (!window.confirm('Retirer cette pièce jointe de la fiche ?')) return;
            return this.run(() => contentRequest(this.endpoint() + '/' + encodeURIComponent(attachment.public_id), 'DELETE'));
        },
    },
};
