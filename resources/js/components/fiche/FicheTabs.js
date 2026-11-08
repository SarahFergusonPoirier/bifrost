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
    props: { path: String, templatesPath: String, active: String, canCopy: Boolean },
    emits: ['select', 'copied'],
    data: () => ({ icons, optionalTabs, layout: null, tabs: [], saving: false, error: '', templates: null, templateName: '', templateScope: 'project', templateId: null }),
    computed: {
        hasPendingText() {
            return this.tabs.some(tab => tab.placements?.some(placement => placement.newText));
        },
        selectedTemplate() {
            return this.templates?.find(template => template.id === this.templateId);
        },
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
        async loadTemplates() {
            if (this.templates) return;
            this.error = '';
            try {
                this.templates = (await contentRequest(this.templatesPath)).data;
            } catch (error) {
                this.error = error.message;
            }
        },
        async saveTemplate() {
            this.saving = true;
            this.error = '';
            try {
                const { data } = await contentRequest(this.path.replace(/fiche-layout$/, 'fiche-tab-templates'), 'POST', {
                    name: this.templateName, scope: this.templateScope, tab: this.active, version: this.layout.version,
                });
                if (this.templates) this.templates.push(data);
                this.templateName = '';
                this.templateId = data.id;
            } catch (error) {
                this.error = error.message;
            } finally {
                this.saving = false;
            }
        },
        applyTemplate() {
            const definition = this.selectedTemplate?.definition;
            if (!definition || this.tabs.length >= 24) return;
            const textSlots = new Map();
            this.tabs.push({
                id: 'tab-' + crypto.randomUUID(),
                title: definition.title,
                icon: definition.icon,
                hidden: false,
                placements: definition.placements.map(placement => {
                    const id = crypto.randomUUID();
                    if (!placement.source.startsWith('blank:')) return { ...placement, id };
                    if (!textSlots.has(placement.source)) textSlots.set(placement.source, crypto.randomUUID());
                    return { ...placement, id, source: 'text:' + textSlots.get(placement.source), newText: true };
                }),
            });
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
        savePlacements(next, transfers, defaults, copies) {
            return this.save(this.layout.tabs.map(tab => {
                if (tab.id === this.active) return { ...tab, placements: next };
                const added = transfers.filter(transfer => transfer.tab === tab.id).map(transfer => transfer.placement);
                return added.length ? { ...tab, placements: [...(tab.placements ?? (tab.id === 'overview' ? defaults : defaults.filter(placement => placement.source === tab.id))), ...added] } : tab;
            }), copies);
        },
        saveTabs() {
            if (this.hasPendingText && !this.canCopy) return;
            const copies = new Map();
            const tabs = this.tabs.map(tab => {
                if (!tab.placements) return tab;
                const placements = tab.placements.map(({ newText, ...placement }) => {
                    if (newText) {
                        const id = placement.source.slice(5);
                        copies.set(id, { id, source: 'blank', title: 'Texte' });
                    }
                    return placement;
                });
                return { ...tab, placements };
            });
            return this.save(tabs, [...copies.values()]);
        },
        async save(tabs, copies = []) {
            this.saving = true;
            this.error = '';
            try {
                const { data } = await contentRequest(this.path, 'PUT', { version: this.layout.version, tabs, copies });
                this.accept(data);
                if (copies.length) this.$emit('copied');
                return true;
            } catch (error) {
                this.error = error.message;
            } finally {
                this.saving = false;
            }
        },
    },
};
