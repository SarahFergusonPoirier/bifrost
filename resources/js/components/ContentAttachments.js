import { contentRequest } from '../services/contentRecovery';

export default {
    props: { contentId: { type: String, required: true }, readOnly: Boolean, gallery: Boolean },
    data: () => ({ attachments: [], alt: '', caption: '', busy: false, error: '' }),
    computed: {
        images() {
            return this.attachments.filter(item => item.metadata?.image_mime);
        },
    },
    mounted() {
        if (this.readOnly) this.run(() => {});
    },
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
                const { data } = await contentRequest(this.endpoint());
                this.attachments = Array.isArray(data) ? data : [];
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
                if (this.alt.trim()) data.set('alt', this.alt.trim());
                if (this.caption.trim()) data.set('caption', this.caption.trim());
                await contentRequest(this.endpoint(), 'POST', data);
                input.value = '';
                this.alt = '';
                this.caption = '';
            });
        },
        remove(attachment) {
            if (!window.confirm('Retirer cette pièce jointe de la fiche ?')) return;
            return this.run(() => contentRequest(this.endpoint() + '/' + encodeURIComponent(attachment.public_id), 'DELETE'));
        },
    },
};
