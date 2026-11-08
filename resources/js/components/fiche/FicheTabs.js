import WorkspaceIcon from '../WorkspaceIcon.vue';
import { contentRequest } from '../../services/contentRecovery';

const icons = [
    ['overview', 'Accueil'], ['catalogue', 'Fiche'], ['connections', 'Relations'],
    ['timeline', 'Chronologie'], ['folder', 'Dossier'], ['narration', 'Texte'], ['ideas', 'Idée'],
];
const optionalTabs = [['capabilities', 'Capacités'], ['equipment', 'Équipements']];
const fallbackTabs = [
    { id: 'overview', title: 'Vue d’ensemble', icon: 'overview', hidden: false },
    { id: 'details', title: 'Informations générales', icon: 'catalogue', hidden: false },
];

export default {
    components: { WorkspaceIcon },
    props: { path: String, active: String },
    emits: ['select'],
    data: () => ({ icons, optionalTabs, layout: null, tabs: [], saving: false, error: '' }),
    computed: {
        visibleTabs() {
            return (this.layout?.tabs ?? fallbackTabs).filter(tab => !tab.hidden);
        },
    },
    mounted() {
        if (this.path) this.load();
    },
    methods: {
        accept(layout) {
            this.layout = layout;
            this.reset();
            if (!this.visibleTabs.some(tab => tab.id === this.active)) {
                this.$emit('select', this.visibleTabs.find(tab => tab.id === 'overview')?.id ?? this.visibleTabs[0].id);
            }
        },
        async load() {
            this.error = '';
            try {
                this.accept((await contentRequest(this.path)).data);
            } catch (error) {
                this.error = error.message;
            }
        },
        reset() {
            this.tabs = this.layout.tabs.map(tab => ({ ...tab }));
        },
        add(id = 'tab-' + crypto.randomUUID(), title = 'Nouvel onglet') {
            this.tabs.push({ id, title, icon: 'folder', hidden: false });
        },
        move(index, offset) {
            const [tab] = this.tabs.splice(index, 1);
            this.tabs.splice(index + offset, 0, tab);
        },
        remove(tab) {
            if (window.confirm(`Supprimer l’onglet « ${tab.title} » ? Les données de la fiche seront conservées.`)) {
                this.tabs = this.tabs.filter(item => item.id !== tab.id);
            }
        },
        async save() {
            this.saving = true;
            this.error = '';
            try {
                const { data } = await contentRequest(this.path, 'PUT', { version: this.layout.version, tabs: this.tabs });
                this.accept(data);
            } catch (error) {
                this.error = error.message;
            } finally {
                this.saving = false;
            }
        },
    },
};
