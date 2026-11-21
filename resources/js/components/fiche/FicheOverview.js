import { formatTemporalDate } from './formatFieldValue';
import FicheBlockDeletion from './FicheBlockDeletion.vue';
import { contentRequest } from '../../services/contentRecovery';
import { identitySectionTitle } from './identitySection';
import { templateSectionLabel } from './templateFields';
import { defaultPlacementsFor, mergePlacements } from './fichePlacementDefaults';
import FicheFieldHistory from './FicheFieldHistory.vue';
import FicheTags from './FicheTags.vue';
import FicheScale from './FicheScale.vue';
import ContentAttachments from '../ContentAttachments.vue';
import { icons } from './ficheIcons';
import FicheLinkedData from './FicheLinkedData.vue';
import FicheBlock from './FicheBlock.vue';
import FicheText from './FicheText.vue';
import FicheTextEditor from './FicheTextEditor.vue';
import FicheEntryFields from './FicheEntryFields.vue';
import WorkspaceIcon from '../WorkspaceIcon.vue';

function clampSize(size) {
    return Math.max(1, Math.min(12, size));
}

function placement(source, id = crypto.randomUUID()) {
    return { id, source, width: 6, height: 2, hidden: false, collapsed: false };
}

export default {
    components: { FicheBlockDeletion, FicheFieldHistory, FicheBlock, FicheText, FicheTextEditor, FicheEntryFields, FicheTags, FicheScale, FicheLinkedData, ContentAttachments, WorkspaceIcon },
    props: {
        summary: String,
        fullName: String,
        resolveReference: Function,
        active: String,
        layoutVersion: Number,
        blockLibraryPath: String,
        blockSavePath: String,
        blockDeletionPath: String,
        linksPath: String,
        contentVersion: String,
        attachmentsRevision: Number,
        connectionsPath: String,
        referenceTargets: { type: Array, default: () => [] },
        equipmentType: Number,
        contentId: String,
        linkedTabs: { type: Array, default: () => [] },
        tags: { type: Array, default: () => [] },
        blocks: { type: Array, default: () => [] },
        templateSections: { type: Map, required: true },
        hiddenFields: { type: Array, required: true },
        displayValue: { type: Function, required: true },
        fieldValue: Function,
        formatHistoricalValue: Function,
        fieldState: Function,
        fieldReferences: { type: Function, default: () => [] },
        placements: Array,
        persist: Function,
        canCopy: Boolean,
        destinations: { type: Array, default: () => [] },
        useDefaults: { type: Boolean, default: true },
    },
    emits: ['open', 'select', 'block-deleted', 'edit-text', 'edit-field', 'edit-attachments'],
    data: () => ({ icons, editing: false, savingLayout: false, source: '', draft: [], draftVersion: null, dragged: null, destination: '', transfers: [], resizing: null, copies: [], query: '', newTitle: 'Texte', newBody: '', blockTemplates: [], blockTemplateId: null, blockTemplateName: '', blockTemplateScope: 'project', templatePlacementId: null, libraryError: '', savingBlockTemplate: false, loadingBlockTemplates: false }),
    computed: {
        editableEntryFields() {
            const fields = {};
            for (const section of this.templateSections.values()) {
                for (const field of section) {
                    if (['capabilities', 'equipment'].includes(field.format)
                        && !this.hiddenFields.includes(field.field_definition_id) && !this.fieldState?.(field)) {
                        fields[field.format] ??= field.field_definition_id;
                    }
                }
            }
            return fields;
        },
        textBlockTitles() {
            const query = this.query.trim().toLocaleLowerCase('fr');
            return ['Texte', 'Biographie', 'Personnalité', 'Résumé'].filter(title => title.toLocaleLowerCase('fr').includes(query));
        },
        cards() {
            const identityTitle = identitySectionTitle(this.templateSections);
            const sections = Array.from(this.templateSections, ([title, fields]) => ({
                source: 'section:' + title,
                aliases: [...new Set(fields.flatMap(field => field.display_options?.section_aliases ?? []))],
                fullName: title === identityTitle ? this.fullName : null,
                title: templateSectionLabel(title, fields),
                icon: 'catalogue',
                fields: fields.filter(field => !this.hiddenFields.includes(field.field_definition_id)).map(field => ({
                    id: field.id,
                    definitionId: field.field_definition_id,
                    historyField: field.display_options?.history_view === 'history' ? field : null,
                    label: field.label_override || field.field_definition.label,
                    value: this.displayValue(field),
                    richText: field.richText && !this.fieldState?.(field),
                    empty: this.isEmptyField(field),
                    references: this.fieldReferences(field),
                    badgeColor: field.field_definition.value_type === 'choice' && this.fieldValue?.(field)
                        ? field.display_options?.badge_color : null,
                    url: field.format === 'external_link' ? this.safeExternalUrl(this.fieldValue?.(field)?.url) : null,
                    image: field.format === 'image' ? this.fieldValue?.(field)?.image : null,
                    levelMode: field.display_options?.repeatable_level_mode,
                    entries: ['repeatable', 'bullets'].includes(field.format) ? this.fieldValue?.(field) : null,
                    keywords: field.format === 'keywords' ? this.fieldValue?.(field) : null,
                    scale: field.format === 'scale' && this.fieldValue?.(field)?.level && this.fieldValue(field).level <= (field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5)
                        ? {
                            level: this.fieldValue(field).level,
                            levels: field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5,
                            descriptions: field.display_options?.level_descriptions ?? [],
                            mode: field.display_options?.scale_display ?? 'both',
                        }
                        : null,
                })),
            }));
            const fields = [...new Map(sections.flatMap(section => section.fields).map(field => [field.definitionId, field])).values()];
            const externalLinks = fields.filter(field => field.url);
            const texts = this.blocks.filter(block => block.public_id).map(block => ({
                source: 'text:' + block.public_id,
                title: block.title || 'Texte',
                text: block.body ?? '',
                icon: 'narration',
            }));
            return [
                { source: 'summary', title: 'Résumé', text: this.summary, icon: 'catalogue' },
                { source: 'tags', title: 'Étiquettes', tags: this.tags, keywords: this.localKeywords, icon: 'folder' },
                ...(this.linksPath ? [
                    { source: 'relations', title: 'Relations', icon: 'connections', linked: true },
                    { source: 'timeline', title: 'Chronologie', icon: 'timeline', linked: true },
                    { source: 'equipment', title: 'Équipements', icon: 'folder', linked: true },
                ] : []),
                ...(this.contentId ? [{ source: 'attachments', title: 'Pièces jointes', icon: 'folder' }, { source: 'gallery', title: 'Galerie d’images', icon: 'folder' }] : []),
                ...(this.contentId ? [{ source: 'capabilities', title: 'Capacités', icon: 'ideas', entries: this.localCapabilities }] : []),
                { source: 'external-links', title: 'Liens externes', icon: 'folder', fields: externalLinks },
                { source: 'fields', title: 'Bloc de champs personnalisé', icon: 'catalogue',
                    fields },
                ...sections,
                ...texts,
                ...this.copies.map(copy => ({ ...copy.card, source: 'text:' + copy.id })),
            ];
        },
        localKeywords() {
            return [...this.templateSections.values()].flatMap(fields => fields
                .filter(field => field.format === 'keywords' && !this.hiddenFields.includes(field.field_definition_id))
                .flatMap(field => {
                    const entries = this.fieldValue?.(field);
                    if (!Array.isArray(entries)) return [];
                    return entries.map((entry, index) => ({
                        id: field.field_definition_id + ':' + index,
                        name: entry.label,
                        description: entry.description,
                    }));
                }));
        },
        localCapabilities() {
            return [...this.templateSections.values()].flatMap(fields => fields
                .filter(field => field.format === 'capabilities' && !this.hiddenFields.includes(field.field_definition_id))
                .flatMap(field => this.fieldValue?.(field) || []));
        },
        localEquipment() {
            return [...this.templateSections.values()].flatMap(fields => fields
                .filter(field => field.format === 'equipment' && !this.hiddenFields.includes(field.field_definition_id))
                .flatMap(field => {
                    const entries = this.fieldValue?.(field);
                    if (!Array.isArray(entries)) return [];
                    return entries.map((entry, index) => ({
                        id: 'local-' + field.field_definition_id + '-' + index,
                        title: entry.label,
                        note: entry.description,
                        fields: entry.fields,
                        image: entry.image && this.contentId
                            ? '/api/contents/' + encodeURIComponent(this.contentId) + '/attachments/' + encodeURIComponent(entry.image) + '/preview'
                            : null,
                    }));
                }));
        },
        matchingCards() {
            const query = this.query.trim().toLocaleLowerCase('fr');
            return this.cards.filter(card => card.title.toLocaleLowerCase('fr').includes(query));
        },
        matchingBlockTemplates() {
            const query = this.query.trim().toLocaleLowerCase('fr');
            return this.blockTemplates.filter(template => template.name.toLocaleLowerCase('fr').includes(query));
        },
        selectedLibraryEntry() {
            return this.matchingBlockTemplates.find(template => template.id === this.blockTemplateId);
        },
        selectedSavedPlacement() {
            return this.placements?.find(placement => placement.id === this.templatePlacementId);
        },
        selectedBlockTemplate() {
            return this.selectedLibraryEntry?.definition.placements[0];
        },
        selectedCard() {
            return this.matchingCards.find(card => card.source === this.source);
        },
        bySource() {
            const index = new Map(this.cards.map(card => [card.source, card]));
            const aliases = new Map();
            for (const card of this.cards) {
                for (const label of card.aliases ?? []) {
                    const source = 'section:' + label;
                    aliases.set(source, aliases.has(source) ? null : card);
                }
            }
            for (const [source, card] of aliases) {
                if (card && !index.has(source)) index.set(source, card);
            }
            return index;
        },
        defaults() {

            return this.cards.filter(card => !['fields', 'external-links'].includes(card.source)
                && (card.linked || card.entries || card.text || card.tags?.length || card.keywords?.length || card.fields?.length))
                .map(card => placement(card.source, card.source));
        },
        initialPlacements() {
            return defaultPlacementsFor(this.useDefaults ? 'overview' : this.active, this.defaults);
        },
        sharedSources() {
            const sources = new Set();
            const currentSources = new Set();
            const currentPlacements = this.editing ? this.draft : this.placements ?? this.initialPlacements;
            for (const item of currentPlacements) {
                const source = this.resolvedSource(item.source);
                if (currentSources.has(source)) sources.add(source);
                currentSources.add(source);
            }
            for (const tab of this.destinations) {
                const placements = tab.placements ?? defaultPlacementsFor(tab.id, this.defaults);
                for (const item of placements) sources.add(this.resolvedSource(item.source));
            }
            for (const transfer of this.transfers) {
                if (this.editing) sources.add(this.resolvedSource(transfer.placement.source));
            }
            return sources;
        },
        displayed() {
            const placements = this.editing ? this.draft : this.placements ?? this.initialPlacements;
            return placements.filter(item => !item.hidden)
                .map(item => {
                    const card = this.bySource.get(item.source) ?? { title: 'Bloc indisponible', icon: 'catalogue', unavailable: true };
                    const ordered = this.orderedFields(item, card.fields);
                    const fields = item.hide_empty ? ordered.filter(field => !field.empty) : ordered;
                    return { placement: item, card, fields, shared: this.sharedSources.has(this.resolvedSource(item.source)) };
                });
        },
    },
    methods: {
        isEmptyField(field) {
            if (!this.fieldValue || this.fieldState?.(field)) return false;
            const value = this.fieldValue(field);
            return value == null || value === '' || (Array.isArray(value) && value.length === 0);
        },
        linkedTabFor(source) {
            if (this.active === source || this.linkedTabs.includes(source)) return source;
            const containsBlock = placements => placements?.some(item =>
                item.source === source && !item.hidden && !item.collapsed);
            if (this.active?.startsWith('tab-') && containsBlock(this.placements)) return this.active;
            return this.destinations.find(tab => tab.id.startsWith('tab-')
                && !tab.hidden && containsBlock(tab.placements))?.id;
        },
        resolvedSource(source) {
            return this.bySource.get(source)?.source ?? source;
        },
        safeExternalUrl(value) {
            try {
                const url = new URL(value);
                return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
            } catch {
                return null;
            }
        },
        orderedFields(placement, fields = []) {
            if (!placement.field_order) return fields;
            const index = new Map(fields.map(field => [field.definitionId, field]));
            return placement.field_order.map(id => index.get(id)).filter(Boolean);
        },
        toggleField(placement, fields, id, visible) {
            const order = placement.field_order ?? fields.map(field => field.definitionId);
            placement.field_order = visible ? [...new Set([...order, id])] : order.filter(item => item !== id);
        },
        moveField(placement, fields, id, offset) {
            const order = [...(placement.field_order ?? fields.map(field => field.definitionId))];
            const visible = this.orderedFields(placement, fields);
            const neighbor = visible[visible.findIndex(field => field.definitionId === id) + offset];
            if (!neighbor) return;
            const index = order.indexOf(id);
            const next = order.indexOf(neighbor.definitionId);
            [order[index], order[next]] = [order[next], order[index]];
            placement.field_order = order;
        },
        begin() {
            this.draftVersion = this.layoutVersion;
            this.draft = this.placements?.map(item => ({ ...item }))
                ?? this.initialPlacements.map(item => placement(item.source));
            this.transfers = [];
            this.copies = [];
            this.editing = true;
            this.$nextTick(() => this.$refs.blockSearch?.focus());
        },
        add() {
            if (!this.selectedCard || this.draft.length >= 80) return;
            const item = placement(this.source);
            if (item.source === 'fields') item.field_order = [];
            this.draft.push(item);
            this.source = '';
        },
        move(from, to) {
            this.draft.splice(to, 0, this.draft.splice(from, 1)[0]);
        },
        startDrag(event, index) {
            this.dragged = index;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        },
        drop(index) {
            if (this.dragged !== null) this.move(this.dragged, index);
            this.dragged = null;
        },
        startResize(event, item) {
            if (event.button !== 0 || this.resizing) return;
            const grid = getComputedStyle(this.$refs.grid);
            const tracks = grid.gridTemplateColumns.split(' ');
            const block = event.currentTarget.closest('.fiche-block');
            const widthStep = tracks.length === 12 ? parseFloat(tracks[0]) + parseFloat(grid.columnGap) : 0;
            const heightStep = parseFloat(getComputedStyle(block).minHeight) / item.height;
            this.resizing = {
                item, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                width: item.width, height: item.height, widthStep, heightStep,
            };
            event.currentTarget.focus({ preventScroll: true });
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        resize(event) {
            const state = this.resizing;
            if (!state || state.pointerId !== event.pointerId) return;
            if (state.widthStep > 0) {
                state.item.width = clampSize(state.width + Math.round((event.clientX - state.x) / state.widthStep));
            }
            if (state.heightStep > 0) {
                state.item.height = clampSize(state.height + Math.round((event.clientY - state.y) / state.heightStep));
            }
        },
        finishResize(event) {
            if (this.resizing?.pointerId === event.pointerId) this.resizing = null;
        },
        cancelResize(event) {
            const state = this.resizing;
            if (!state || state.pointerId !== event.pointerId) return;
            state.item.width = state.width;
            state.item.height = state.height;
            this.resizing = null;
        },
        resizeWithKeyboard(event, item) {
            if (event.key === 'Escape' && this.resizing?.item === item) {
                event.preventDefault();
                const { pointerId } = this.resizing;
                this.cancelResize({ pointerId });
                if (event.currentTarget.hasPointerCapture?.(pointerId)) {
                    event.currentTarget.releasePointerCapture(pointerId);
                }
                return;
            }
            const deltas = { ArrowLeft: ['width', -1], ArrowRight: ['width', 1], ArrowUp: ['height', -1], ArrowDown: ['height', 1] };
            const delta = deltas[event.key];
            if (!delta) return;
            event.preventDefault();
            const [dimension, step] = delta;
            item[dimension] = clampSize(item[dimension] + step);
        },
        canTransfer(item) {
            const target = this.destinations.find(tab => tab.id === this.destination);
            if (!target || target.hidden) return false;
            const pending = this.transfers.filter(transfer => transfer.tab === target.id).map(transfer => transfer.placement);
            return mergePlacements(target, [...pending, item], this.defaults).length <= 80;
        },
        transfer(index, shared) {
            const item = this.draft[index];
            if (!this.canTransfer(item)) return;
            const copy = shared ? { ...item, id: crypto.randomUUID() } : this.draft.splice(index, 1)[0];
            this.transfers.push({ tab: this.destination, placement: copy, originalIndex: shared ? null : index });
        },
        undoTransfer(index) {
            const transfer = this.transfers[index];
            if (transfer.originalIndex !== null) {
                if (this.draft.length >= 80) return;
                this.draft.splice(transfer.originalIndex, 0, transfer.placement);
            }
            this.transfers.splice(index, 1);
        },
        formatTemporalDate,
        blockLabel(item, fallback = 'Texte vierge') {
            if (item.title) return item.title;
            if (item.source.startsWith('blank:')) return fallback;
            return this.bySource.get(item.source)?.title ?? 'Bloc indisponible';
        },
        async loadBlockTemplates() {
            if (this.loadingBlockTemplates || this.savingBlockTemplate) return;
            this.loadingBlockTemplates = true;
            this.libraryError = '';
            try {
                const { data } = await contentRequest(this.blockLibraryPath + '?kind=block');
                this.blockTemplates = data;
            } catch (error) {
                this.libraryError = error.message;
            } finally {
                this.loadingBlockTemplates = false;
            }
        },
        async saveBlockTemplate(update = false) {
            if (this.loadingBlockTemplates || this.savingBlockTemplate || !this.templatePlacementId || !this.blockTemplateName.trim()) return;
            const existing = update ? this.selectedLibraryEntry : null;
            if (update && !existing) return;
            this.savingBlockTemplate = true;
            this.libraryError = '';
            try {
                const { data } = await contentRequest(this.blockSavePath, 'POST', {
                    name: this.blockTemplateName.trim(), scope: existing?.scope ?? this.blockTemplateScope, tab: this.active,
                    version: this.layoutVersion, placement: this.templatePlacementId,
                    ...(existing ? { template_id: existing.id, revision: existing.definition.revision ?? 1 } : {}),
                });
                this.blockTemplates = [...this.blockTemplates.filter(template => template.id !== data.id), data];
                this.blockTemplateId = data.id;
                this.blockTemplateName = '';
            } catch (error) {
                this.libraryError = error.message;
            } finally {
                this.savingBlockTemplate = false;
            }
        },
        applyBlockTemplate() {
            const template = this.selectedBlockTemplate;
            if (!template || this.draft.length >= 80) return;
            if (template.source.startsWith('blank:')) {
                if (!this.canCopy) return;
                this.addTextPlacement(this.blockLabel(template, this.selectedLibraryEntry.name), '', template);
            } else if (this.bySource.has(template.source)) {
                this.draft.push({ ...template, id: crypto.randomUUID() });
            }
        },
        chooseTextBlockTitle(title) {
            this.newTitle = title;
            this.$nextTick(() => this.$refs.textBlockTitle?.focus());
        },
        createTextBlock() {
            const title = this.newTitle.trim();
            if (!title || this.draft.length >= 80) return;
            this.addTextPlacement(title, this.newBody);
            this.newBody = '';
        },
        addTextPlacement(title, body, settings = {}) {
            const id = crypto.randomUUID();
            const card = { title, text: body, icon: 'narration' };
            this.copies.push({ id, source: 'blank', title, body, card });
            const item = placement('text:' + id);
            this.draft.push({ ...item, ...settings, id: item.id, source: item.source });
        },
        duplicate(index) {
            const original = this.draft[index];
            const card = this.bySource.get(original.source);
            const id = crypto.randomUUID();
            const staged = this.copies.some(copy => original.source === 'text:' + copy.id);
            this.copies.push(staged
                ? { id, source: 'blank', title: card.title, body: card.text, card }
                : { id, source: original.source, card });
            this.draft.splice(index + 1, 0, { ...original, id: crypto.randomUUID(), source: 'text:' + id });
        },
        cancel() {
            this.copies = [];
            this.editing = false;
            this.$nextTick(() => this.$refs.editButton?.focus());
        },
        async save() {
            if (this.savingLayout) return;
            const placed = new Set([...this.draft, ...this.transfers.map(item => item.placement)].map(item => item.source));
            const copies = this.copies.filter(copy => placed.has('text:' + copy.id)).map(({ card, ...copy }) => copy);
            const defaults = this.defaults.filter(item => !this.copies.some(copy => item.source === 'text:' + copy.id))
                .map(item => placement(item.source));
            this.savingLayout = true;
            try {
                const transfers = this.transfers.map(({ tab, placement }) => ({ tab, placement }));
                if (await this.persist(this.draft, transfers, defaults, copies, this.draftVersion)) this.cancel();
            } finally {
                this.savingLayout = false;
            }
        },
    },
};
