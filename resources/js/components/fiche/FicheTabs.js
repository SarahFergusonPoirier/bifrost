import { defaultPlacementsFor } from './fichePlacementDefaults';
import WorkspaceIcon from '../WorkspaceIcon.vue';
import { contentRequest } from '../../services/contentRecovery';

import { icons } from './ficheIcons';
const optionalTabs = [['capabilities', 'Capacités'], ['equipment', 'Équipements']];
const fallbackTabs = [
    { id: 'overview', title: 'Vue d’ensemble', icon: 'overview', hidden: false },
    { id: 'details', title: 'Informations générales', icon: 'catalogue', hidden: false },
];

export default {
    components: { WorkspaceIcon },
    props: { path: String, templatesPath: String, active: String, canCopy: Boolean },
    emits: ['select', 'copied'],
    data: () => ({ icons, optionalTabs, layout: null, tabs: [], saving: false, error: '', templates: null, templateName: '', templateScope: 'project', templateId: null, templateQuery: '', removalId: null, removalDestination: null, revisions: null }),
    computed: {
        hasPendingText() {
            return this.tabs.some(tab => tab.placements?.some(placement => placement.newText));
        },
        filteredTemplates() {
            const query = this.templateQuery.trim().toLocaleLowerCase('fr');
            return (this.templates ?? []).filter(template =>
                [template.name, template.definition.title].some(text => text.toLocaleLowerCase('fr').includes(query)));
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
        else this.ensureVisibleTab();
    },
    methods: {
        placementLabel(placement) {
            if (placement.title) return placement.title;
            if (placement.source.startsWith('section:')) return placement.source.slice(8);
            if (placement.source.startsWith('blank:')) return 'Bloc de texte vide';
            return {
                summary: 'Résumé', tags: 'Étiquettes', fields: 'Bloc de champs personnalisé', relations: 'Relations', timeline: 'Chronologie',
                equipment: 'Équipements', capabilities: 'Capacités', gallery: 'Galerie', attachments: 'Pièces jointes',
            }[placement.source] ?? placement.source;
        },
        navigateTabs(event) {
            const index = this.visibleTabs.findIndex(tab => tab.id === event.target.dataset.tab);
            if (index === -1) return;
            const count = this.visibleTabs.length;
            const next = {
                ArrowLeft: (index - 1 + count) % count,
                ArrowRight: (index + 1) % count,
                Home: 0,
                End: count - 1,
            }[event.key];
            if (next === undefined) return;

            event.preventDefault();
            const button = this.$refs.navigation.querySelectorAll('[data-tab]')[next];
            button.focus();
            button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
            this.$emit('select', this.visibleTabs[next].id);
        },
        accept(layout) {
            this.layout = layout;
            this.reset();
            this.ensureVisibleTab();
        },
        ensureVisibleTab() {
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
        async loadRevisions(page = 1) {
            this.error = '';
            try {
                this.revisions = (await contentRequest(this.path + '/revisions?page=' + page)).data;
            } catch (error) {
                this.error = error.message;
            }
        },
        async restoreRevision(revision) {
            if (this.saving || !window.confirm('Restaurer la disposition de la version ' + revision.version + ' ?')) return;
            if (await this.save(revision.tabs)) await this.loadRevisions();
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
            this.cancelRemoval();
        },
        add(id = 'tab-' + crypto.randomUUID(), title = 'Nouvel onglet') {
            this.tabs.push({ id, title, icon: 'folder', hidden: false });
        },
        move(index, offset) {
            const [tab] = this.tabs.splice(index, 1);
            this.tabs.splice(index + offset, 0, tab);
        },
        requestRemoval(tab) {
            this.removalId = tab.id;
            this.removalDestination = null;
        },
        cancelRemoval() {
            this.removalId = null;
            this.removalDestination = null;
        },
        removalTargets(tab) {
            const defaults = ['overview', 'relations', 'timeline', ...optionalTabs.map(([id]) => id)];
            return this.tabs.filter(target => target.id !== tab.id
                && (target.placements || !defaults.includes(target.id))
                && (target.placements?.length ?? 0) + (tab.placements?.length ?? 0) <= 80);
        },
        remove(tab) {
            if (this.removalDestination) {
                const target = this.removalTargets(tab).find(item => item.id === this.removalDestination);
                if (!target) return;
                target.placements = [...(target.placements ?? []), ...(tab.placements ?? [])];
            }

            this.tabs = this.tabs.filter(item => item.id !== tab.id);
            this.cancelRemoval();
        },
        savePlacements(next, transfers, defaults, copies) {
            return this.save(this.layout.tabs.map(tab => {
                if (tab.id === this.active) return { ...tab, placements: next };
                const added = transfers.filter(transfer => transfer.tab === tab.id).map(transfer => transfer.placement);
                if (!added.length) return tab;
                const existing = tab.placements ?? defaultPlacementsFor(tab.id, defaults)
                    .filter(placement => !added.some(item => item.source === placement.source));
                return { ...tab, placements: [...existing, ...added] };
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
                this.revisions = null;
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
