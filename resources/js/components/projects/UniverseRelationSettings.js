import { contentRequest } from '../../services/contentRecovery';

export default {
    props: { projectId: { type: [Number, String], required: true } },
    data: () => ({ universes: null, busy: false, error: '', saved: '', universeName: '' }),
    methods: {
        endpoint() {
            return '/projects/' + encodeURIComponent(this.projectId) + '/relation-universes';
        },
        async load() {
            if (this.busy || this.universes !== null) return;
            this.busy = true;
            this.error = '';
            try {
                const { data } = await contentRequest(this.endpoint());
                this.universes = data.map(universe => ({ ...universe, typesText: universe.relation_types.join('\n') }));
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
        async createUniverse() {
            const name = this.universeName.trim();
            if (!name || this.busy || this.universes === null) return;
            this.busy = true;
            this.error = '';
            this.saved = '';
            try {
                const { data } = await contentRequest(this.endpoint(), 'POST', { name });
                this.universes.push({ ...data, typesText: '' });
                this.universeName = '';
                this.saved = 'Univers créé et rattaché au projet.';
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
        async save(universe) {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            this.saved = '';
            const types = universe.typesText.split('\n').map(type => type.trim()).filter(Boolean);
            try {
                const { data } = await contentRequest(this.endpoint() + '/' + universe.id, 'PUT', { relation_types: types });
                universe.typesText = data.relation_types.join('\n');
                this.saved = 'Types de relations enregistrés pour ' + universe.name + '.';
            } catch (error) {
                this.error = error.message;
            } finally {
                this.busy = false;
            }
        },
    },
};
