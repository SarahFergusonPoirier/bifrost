import { defaultPlacementsFor, mergePlacements } from './fichePlacementDefaults';
import WorkspaceIcon from '../WorkspaceIcon.vue';
import { contentRequest } from '../../services/contentRecovery';
import { normalizeBlockSize } from './blockDimensions';
import { instantiateTemplatePlacements, collectTemplateBindings, templateBindingFields } from './templatePlacements';

import { icons } from './ficheIcons';
const optionalTabs = [['capabilities', 'Capacités'], ['equipment', 'Équipements']];
const fallbackTabs = [
    { id: 'overview', title: 'Vue d’ensemble', icon: 'overview', hidden: false },
    { id: 'details', title: 'Informations générales', icon: 'catalogue', hidden: false },
];

export default {
    components: { WorkspaceIcon },
    props: { path: String, templatesPath: String, active: String, canCopy: Boolean, getDefaultPlacements: Function, resolveSource: Function },
    emits: ['select', 'copied'],
    data: () => ({ icons, optionalTabs, layout: null, tabs: [], saving: false, error: '', conflict: false, reloadCount: 0, templates: null, templateName: '', templateScope: 'project', templateId: null, templateQuery: '', pendingTemplateTab: null, removalId: null, removalDestination: null, revisions: null }),
    computed: {
        hasPendingSources() {
            return this.tabs.some(tab => tab.placements?.some(placement => placement.newText || placement.newFields || placement.newBindings?.length));
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
        templateBindingFields,
        placementLabel(placement) {
            if (placement.title) return placement.title;
            const source = this.resolveSource?.(placement.source);
            if (source) return source.title;
            if (placement.source.startsWith('section:')) return placement.source.slice(8);
            if (placement.source.startsWith('blank:')) return 'Bloc de texte vide';
            if (placement.source.startsWith('blank-fields:')) return this.selectedTemplate?.definition.field_blocks?.[placement.source]?.title || 'Bloc de champs vierge';
            return {
                summary: 'Résumé', tags: 'Étiquettes', fields: 'Bloc de champs personnalisé', relations: 'Relations', timeline: 'Chronologie',
                equipment: 'Équipements', capabilities: 'Capacités', gallery: 'Galerie', attachments: 'Pièces jointes',
            }[placement.source] ?? placement.source;
        },
        unavailableTemplateSource(source) {
            return !source.startsWith('blank:') && !source.startsWith('blank-fields:') && this.resolveSource?.(source) === null;
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
                this.conflict = false;
                return true;
            } catch (error) {
                this.error = error.message;
                return false;
            }
        },
        async reloadAfterConflict() {
            if (this.saving) return;
            this.saving = true;
            try {
                if (await this.load()) this.reloadCount += 1;
            } finally {
                this.saving = false;
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
            const tabId = 'tab-' + crypto.randomUUID();
            this.tabs.push({
                id: tabId,
                title: definition.title,
                icon: definition.icon,
                hidden: false,
                placements: instantiateTemplatePlacements(definition.placements, this.selectedTemplate.id, definition.revision ?? 1),
            });
            this.pendingTemplateTab = tabId;
        },
        reset() {
            this.tabs = this.layout.tabs.map(tab => ({ ...tab }));
            this.pendingTemplateTab = null;
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
        placementsForRemoval(tab, defaults = this.getDefaultPlacements?.() ?? []) {
            return tab.placements ?? defaultPlacementsFor(tab.id, defaults);
        },
        removalTargets(tab) {
            const defaults = this.getDefaultPlacements?.();
            const defaultTabs = ['overview', 'relations', 'timeline', ...optionalTabs.map(([id]) => id)];
            return this.tabs.filter(target => target.id !== tab.id && !target.hidden
                && (target.placements || defaults || !defaultTabs.includes(target.id))
                && mergePlacements(target, this.placementsForRemoval(tab, defaults ?? []), defaults ?? []).length <= 80);
        },
        remove(tab) {
            if (this.removalDestination) {
                const target = this.removalTargets(tab).find(item => item.id === this.removalDestination);
                if (!target) return;
                const materialize = placements => placements.map(placement => normalizeBlockSize({ ...placement, id: crypto.randomUUID() }));
                const added = tab.placements ?? materialize(this.placementsForRemoval(tab));
                const defaults = materialize(this.getDefaultPlacements?.() ?? []);
                target.placements = mergePlacements(target, added, defaults);
            }

            this.tabs = this.tabs.filter(item => item.id !== tab.id);
            this.cancelRemoval();
        },
        savePlacements(next, transfers, defaults, copies, draftVersion = this.layout.version, blockUpdates = []) {
            if (draftVersion !== this.layout.version) {
                this.error = 'La disposition a changé depuis l’ouverture de l’éditeur de blocs.';
                this.conflict = true;
                return false;
            }
            const available = new Set(this.layout.tabs.filter(tab => !tab.hidden && tab.id !== this.active).map(tab => tab.id));
            if (transfers.some(transfer => !available.has(transfer.tab))) {
                this.error = 'Un onglet de destination a été masqué ou supprimé. Annule le transfert concerné avant d’enregistrer.';
                return false;
            }
            return this.save(this.layout.tabs.map(tab => {
                if (tab.id === this.active) return { ...tab, placements: next };
                const added = transfers.filter(transfer => transfer.tab === tab.id).map(transfer => transfer.placement);
                if (!added.length) return tab;
                return { ...tab, placements: mergePlacements(tab, added, defaults) };
            }), copies, blockUpdates);
        },
        async saveTabs() {
            if (this.hasPendingSources && !this.canCopy) return;
            const copies = new Map();
            const tabs = this.tabs.map(tab => {
                if (!tab.placements) return tab;
                const placements = tab.placements.map(({ newText, newFields, newBindings, ...placement }) => {
                    collectTemplateBindings(copies, newBindings);
                    if (newFields) copies.set(placement.source.slice(7), { ...copies.get(placement.source.slice(7)), id: placement.source.slice(7), source: 'template-fields', ...newFields });
                    if (newText) {
                        const id = placement.source.slice(5);
                        const existing = copies.get(id);
                        if (!existing || existing.title === 'Texte') {
                            copies.set(id, { id, source: 'blank', title: placement.title || 'Texte' });
                        }
                    }
                    return placement;
                });
                return { ...tab, placements };
            });
            const pendingTab = this.pendingTemplateTab;
            const saved = await this.save(tabs, [...copies.values()]);
            if (saved && this.visibleTabs.some(tab => tab.id === pendingTab)) this.$emit('select', pendingTab);
            return saved;
        },
        async save(tabs, copies = [], blockUpdates = []) {
            if (this.saving) return false;
            if (!tabs.some(tab => !tab.hidden)) {
                this.error = 'Conserve au moins un onglet visible.';
                return false;
            }
            this.saving = true;
            this.error = '';
            try {
                const { data } = await contentRequest(this.path, 'PUT', { version: this.layout.version, tabs, copies, ...(blockUpdates.length ? { block_updates: blockUpdates } : {}) });
                this.accept(data);
                this.revisions = null;
                if (copies.length || blockUpdates.length) this.$emit('copied');
                return true;
            } catch (error) {
                this.error = error.message;
                this.conflict = error.status === 409;
            } finally {
                this.saving = false;
            }
        },
    },
};
