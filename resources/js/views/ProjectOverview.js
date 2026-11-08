import ProjectToolbar from '../components/ProjectToolbar.vue';
import WorkspaceIcon from '../components/WorkspaceIcon.vue';

export default {
    components: { WorkspaceIcon, ProjectToolbar },
    props: {
        projectId: String, project: Object, categories: Array, recent: Array, folders: Array, busy: Boolean, error: String,
    },
    emits: ['search', 'catalogue', 'category', 'panel', 'content', 'folder'],
    data: () => ({ images: {}, imageError: '' }),
    mounted() {
        try {
            this.images = JSON.parse(localStorage.getItem(this.imageKey()) ?? '{}') ?? {};
        } catch {
            this.images = {};
        }
    },
    methods: {
        imageKey() {
            return 'bifrost:overview-images:' + this.projectId;
        },
        saveImage(slot, value) {
            const next = { ...this.images, [slot]: value };
            try {
                localStorage.setItem(this.imageKey(), JSON.stringify(next));
                this.images = next;
                this.imageError = '';
            } catch {
                this.imageError = 'Le navigateur ne peut pas conserver cette image.';
            }
        },
        chooseImage(slot, event) {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
                this.imageError = 'Choisis une image PNG, JPEG ou WebP de 1 Mo maximum.';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => this.saveImage(slot, reader.result);
            reader.onerror = () => { this.imageError = 'Impossible de lire cette image.'; };
            reader.readAsDataURL(file);
        },
    },
};
