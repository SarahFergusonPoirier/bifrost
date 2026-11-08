import { contentRequest } from '../services/contentRecovery';

export default {
    props: { projectId: { type: String, required: true } },
    emits: ['open-content'],
    data: () => ({
        works: [], choices: [], choiceForm: { source: '', target: '', label: '' }, previewScene: '', trail: [], arcs: [], arcTitle: '', includeNotes: false, workId: '', title: '', sceneTitle: '', view: 'structure', busy: false, error: '',
        statuses: { draft: 'Brouillon', in_progress: 'En cours', completed: 'Terminée', abandoned: 'Abandonnée' },
    }),
    computed: {
        work() {
            return this.works.find(work => work.public_id === this.workId);
        },
        datedGroups() {
            const groups = new Map();
            const undated = [];
            this.work?.scenes.forEach((scene, index) => {
                const entry = { ...scene, narrativePosition: index + 1 };
                if (!scene.date?.start && scene.date?.order == null) {
                    undated.push(entry);
                    return;
                }
                const calendar = scene.date.calendar || 'Calendrier non précisé';
                if (!groups.has(calendar)) groups.set(calendar, []);
                groups.get(calendar).push(entry);
            });
            const order = scene => scene.date.order != null ? 0 : /^\d{4}-\d{2}-\d{2}$/.test(scene.date.start ?? '') ? 1 : 2;
            const result = [...groups].map(([calendar, scenes]) => [calendar, scenes.sort((left, right) => {
                const rank = order(left) - order(right);
                if (rank) return rank;
                if (order(left) === 0) return Number(left.date.order) - Number(right.date.order);
                if (order(left) === 1) return left.date.start.localeCompare(right.date.start);
                return 0;
            })]);
            return undated.length ? [...result, ['Sans repère daté', undated]] : result;
        },
        groups() {
            if (this.view !== 'status') return [['Scènes', this.work?.scenes ?? []]];
            return Object.entries(this.statuses).map(([key, label]) => [label, this.work.scenes.filter(scene => scene.work_status_key === key)]);
        },
    },
    mounted() {
        this.run(() => this.load());
    },
    methods: {
        exportUrl(format) {
            const query = new URLSearchParams({ format, notes: Number(this.includeNotes) });
            return '/api' + this.endpoint() + '/' + encodeURIComponent(this.workId) + '/export?' + query;
        },
        endpoint() {
            return '/projects/' + this.projectId + '/narration';
        },
        async run(action) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try { await action(); } catch (error) { this.error = error.message; } finally { this.busy = false; }
        },
        async load() {
            this.works = (await contentRequest(this.endpoint())).data;
            if (!this.work) this.workId = this.works[0]?.public_id ?? '';
            if (this.view === 'arcs') await this.fetchArcs();
            if (this.view === 'choices') await this.fetchChoices();
        },
        async fetchArcs() {
            this.arcs = this.workId
                ? (await contentRequest(this.endpoint() + '/' + this.workId + '/arcs')).data
                : [];
        },
        showView() {
            if (this.view === 'choices') return this.run(() => this.fetchChoices(true));
            if (this.view === 'arcs') return this.run(() => this.fetchArcs());
        },
        async fetchChoices(reset = false) {
            this.choices = this.workId
                ? (await contentRequest(this.endpoint() + '/' + this.workId + '/choices')).data : [];
            if (reset) {
                this.choiceForm = { source: '', target: '', label: '' };
                this.startPreview(this.work?.scenes[0]?.public_id ?? '');
            }
        },
        saveChoice() {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/' + this.workId + '/choices', 'PUT', this.choiceForm);
                this.choiceForm.label = '';
                await this.fetchChoices();
            });
        },
        removeChoice(choice) {
            if (!window.confirm('Retirer ce choix du parcours ?')) return;
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/' + this.workId + '/choices/' + choice.id, 'DELETE');
                await this.fetchChoices();
            });
        },
        sceneTitleFor(id) {
            return this.work?.scenes.find(scene => scene.public_id === id)?.title ?? 'Scène indisponible';
        },
        startPreview(id) {
            this.previewScene = id;
            this.trail = [];
        },
        follow(choice) {
            this.previewScene = choice.target;
            this.trail.push(choice.label);
        },
        createArc() {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/' + this.workId + '/arcs', 'POST', { title: this.arcTitle });
                this.arcTitle = '';
                await this.fetchArcs();
            });
        },
        saveArc(arc, event) {
            const scenes = [...event.target.selectedOptions].map(option => option.value);
            return this.run(async () => {
                try {
                    await contentRequest(this.endpoint() + '/' + this.workId + '/arcs/' + arc.public_id, 'PUT', { scenes });
                } finally {
                    await this.fetchArcs();
                }
            });
        },
        createWork() {
            return this.run(async () => {
                const { data } = await contentRequest(this.endpoint(), 'POST', { title: this.title });
                this.workId = data.public_id;
                this.title = '';
                await this.load();
            });
        },
        createScene() {
            return this.run(async () => {
                await contentRequest(this.endpoint() + '/' + this.workId + '/scenes', 'POST', { title: this.sceneTitle });
                this.sceneTitle = '';
                await this.load();
            });
        },
        move(index, delta) {
            return this.run(async () => {
                const ids = this.work.scenes.map(scene => scene.public_id);
                const [id] = ids.splice(index, 1);
                ids.splice(index + delta, 0, id);
                await contentRequest(this.endpoint() + '/' + this.workId + '/scenes/order', 'PUT', { scenes: ids });
                await this.load();
            });
        },
    },
};
