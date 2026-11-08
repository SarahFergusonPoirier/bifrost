import { contentRequest } from '../services/contentRecovery';

export default {
    props: { projectId: { type: String, required: true } },
    emits: ['open-content'],
    data: () => ({
        nodes: [], edges: [], selection: null, target: '', type: '', filter: '', busy: false, error: '', drag: null,
    }),
    computed: {
        shown() {
            const search = this.filter.trim().toLocaleLowerCase('fr');
            return this.nodes.filter(node => node.title.toLocaleLowerCase('fr').includes(search));
        },
        shownEdges() {
            const visible = new Map(this.shown.map(node => [node.id, node]));
            return this.edges.filter(edge => visible.has(edge.source_content_id) && visible.has(edge.target_content_id))
                .map(edge => ({ ...edge, source: visible.get(edge.source_content_id), target: visible.get(edge.target_content_id) }));
        },
        connections() {
            return this.edges.filter(edge => [edge.source_content_id, edge.target_content_id].includes(this.selection?.id));
        },
    },
    mounted() {
        this.run(() => this.load());
    },
    methods: {
        async run(action) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try { await action(); } catch (error) { this.error = error.message; } finally { this.busy = false; }
        },
        async load() {
            const { data } = await contentRequest('/projects/' + this.projectId + '/connections');
            this.nodes = data.nodes.map((node, index) => ({
                ...node, x: node.x ?? ((index % 7) + 1) / 8,
                y: node.y ?? ((Math.floor(index / 7) % 7) + 1) / 8,
            }));
            this.edges = data.edges;
            this.selection = this.nodes.find(node => node.id === this.selection?.id) ?? null;
        },
        select(node) {
            this.selection = node;
            this.target = '';
        },
        start(event, node) {
            if (this.busy || event.button !== 0) return;
            this.select(node);
            this.drag = { node, x: node.x, y: node.y, moved: false };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        move(event) {
            if (!this.drag) return;
            const rect = this.$refs.graph.getBoundingClientRect();
            const { node } = this.drag;
            node.x = Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width));
            node.y = Math.max(0.02, Math.min(0.98, (event.clientY - rect.top) / rect.height));
            this.drag.moved = true;
        },
        finish(cancelled = false) {
            const drag = this.drag;
            this.drag = null;
            if (!drag?.moved) return;
            const { node, x, y } = drag;
            if (cancelled) {
                Object.assign(node, { x, y });
                return;
            }
            return this.run(async () => {
                try {
                    await contentRequest('/projects/' + this.projectId + '/graph/positions/' + node.public_id, 'PUT', { x: node.x, y: node.y });
                } catch (error) {
                    Object.assign(node, { x, y });
                    throw error;
                }
            });
        },
        peer(edge) {
            const id = edge.source_content_id === this.selection.id ? edge.target_content_id : edge.source_content_id;
            return this.nodes.find(node => node.id === id);
        },
        add() {
            return this.run(async () => {
                await contentRequest('/projects/' + this.projectId + '/connections', 'POST', {
                    source: this.selection.public_id, target: this.target, type_key: this.type,
                });
                this.target = '';
                this.type = '';
                await this.load();
            });
        },
        remove(edge) {
            if (!window.confirm('Supprimer cette relation ?')) return;
            return this.run(async () => {
                await contentRequest('/projects/' + this.projectId + '/connections/' + edge.id, 'DELETE');
                await this.load();
            });
        },
    },
};
