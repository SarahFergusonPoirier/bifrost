import { contentRequest } from '../services/contentRecovery';

const emptyFilters = () => ({ search: '', type: '', status: '', folder: '', tag: '', relation: '', depth: 0, mode: 'all', anchor: '' });

export default {
    props: { projectId: { type: String, required: true } },
    emits: ['open-content'],
    data: () => ({
        nodes: [], edges: [], selection: null, target: '', type: '', filters: emptyFilters(), folders: [], memberships: [], views: [], viewName: '', busy: false, error: '', drag: null,
    }),
    computed: {
        types() {
            return [...new Map(this.nodes.map(node => [node.content_type_id, node.content_type])).entries()];
        },
        tags() {
            return [...new Map(this.nodes.flatMap(node => (node.tags ?? []).map(tag => [tag.id, tag]))).values()];
        },
        relationTypes() {
            return [...new Set(this.edges.map(edge => edge.type_key))].sort();
        },
        shown() {
            const { search, type, status, folder, tag, relation, depth, mode, anchor } = this.filters;
            const text = (search ?? '').trim().toLocaleLowerCase('fr');
            const descendants = new Set(folder ? [Number(folder)] : []);
            for (const parent of descendants) {
                for (const child of this.folders) {
                    if (child.parent_id === parent) descendants.add(child.id);
                }
            }
            const members = new Set(this.memberships.filter(item => descendants.has(item.folder_id)).map(item => item.content_id));
            const edges = relation ? this.edges.filter(edge => edge.type_key === relation) : this.edges;
            const incident = new Set(edges.flatMap(edge => [edge.source_content_id, edge.target_content_id]));
            const anchorId = this.nodes.find(node => node.public_id === anchor)?.id;
            const reachable = new Set(anchorId ? [anchorId] : []);

            for (let distance = 0; distance < depth && anchorId; distance++) {
                const previous = new Set(reachable);
                for (const edge of edges) {
                    if (previous.has(edge.source_content_id)) reachable.add(edge.target_content_id);
                    if (previous.has(edge.target_content_id)) reachable.add(edge.source_content_id);
                }
            }

            return this.nodes.filter(node => {
                const checks = [];
                if (text) checks.push(node.title.toLocaleLowerCase('fr').includes(text));
                if (type) checks.push(node.content_type_id === Number(type));
                if (status) checks.push(node.work_status_key === status);
                if (folder) checks.push(members.has(node.id));
                if (tag) checks.push(node.tags?.some(item => item.id === Number(tag)));
                if (relation) checks.push(incident.has(node.id));
                if (depth && anchor) checks.push(reachable.has(node.id));
                return !checks.length || (mode === 'any' ? checks.some(Boolean) : checks.every(Boolean));
            });
        },
        shownEdges() {
            const visible = new Map(this.shown.map(node => [node.id, node]));
            return this.edges.filter(edge => visible.has(edge.source_content_id) && visible.has(edge.target_content_id) && (!this.filters.relation || edge.type_key === this.filters.relation))
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
            this.folders = data.folders ?? [];
            this.memberships = data.memberships ?? [];
            this.views = data.views ?? [];
            this.selection = this.nodes.find(node => node.id === this.selection?.id) ?? null;
        },
        saveView() {
            return this.run(async () => {
                await contentRequest('/projects/' + this.projectId + '/graph/views', 'PUT', {
                    name: this.viewName, filters: this.filters,
                });
                this.viewName = '';
                await this.load();
            });
        },
        applyView(view) {
            this.filters = { ...emptyFilters(), ...view.filters };
            this.selection = this.nodes.find(node => node.public_id === this.filters.anchor) ?? null;
        },
        deleteView(view) {
            if (!window.confirm('Supprimer cette vue enregistrée ?')) return;
            return this.run(async () => {
                await contentRequest('/projects/' + this.projectId + '/graph/views/' + view.id, 'DELETE');
                await this.load();
            });
        },
        resetFilters() {
            this.filters = emptyFilters();
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
