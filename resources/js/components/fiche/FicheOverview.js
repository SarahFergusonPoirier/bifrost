import { icons } from './ficheIcons';
import FicheLinkedData from './FicheLinkedData.vue';
import FicheBlock from './FicheBlock.vue';
import FicheText from './FicheText.vue';

function clampSize(size) {
    return Math.max(1, Math.min(12, size));
}

function placement(source, id = crypto.randomUUID()) {
    return { id, source, width: 6, height: 2, hidden: false, collapsed: false };
}

export default {
    components: { FicheBlock, FicheText, FicheLinkedData },
    props: {
        summary: String,
        active: String,
        linksPath: String,
        linkedTabs: { type: Array, default: () => [] },
        tags: { type: Array, default: () => [] },
        blocks: { type: Array, default: () => [] },
        templateSections: { type: Map, required: true },
        hiddenFields: { type: Array, required: true },
        displayValue: { type: Function, required: true },
        fieldValue: Function,
        fieldReferences: { type: Function, default: () => [] },
        placements: Array,
        persist: Function,
        canCopy: Boolean,
        destinations: { type: Array, default: () => [] },
        useDefaults: { type: Boolean, default: true },
    },
    emits: ['open', 'select'],
    data: () => ({ icons, editing: false, source: '', draft: [], dragged: null, destination: '', transfers: [], resizing: null, copies: [], query: '', newTitle: 'Texte', newBody: '' }),
    computed: {
        cards() {
            const sections = Array.from(this.templateSections, ([title, fields]) => ({
                source: 'section:' + title,
                title,
                icon: 'catalogue',
                fields: fields.filter(field => !this.hiddenFields.includes(field.field_definition_id)).map(field => ({
                    id: field.id,
                    definitionId: field.field_definition_id,
                    label: field.label_override || field.field_definition.label,
                    value: this.displayValue(field),
                    empty: this.fieldValue?.(field) === '',
                    references: this.fieldReferences(field),
                    scale: field.format === 'scale' && this.fieldValue?.(field)?.level
                        ? { level: this.fieldValue(field).level, levels: field.field_definition.options_data?.levels ?? 5 }
                        : null,
                })),
            }));
            const texts = this.blocks.filter(block => block.public_id && typeof block.body === 'string').map(block => ({
                source: 'text:' + block.public_id,
                title: block.title || 'Texte',
                text: block.body,
                icon: 'narration',
            }));
            return [
                { source: 'summary', title: 'Résumé', text: this.summary, icon: 'catalogue' },
                { source: 'tags', title: 'Étiquettes', tags: this.tags, icon: 'folder' },
                ...(this.linksPath ? [
                    { source: 'relations', title: 'Relations', icon: 'connections', linked: true },
                    { source: 'timeline', title: 'Chronologie', icon: 'timeline', linked: true },
                ] : []),
                ...sections,
                ...texts,
                ...this.copies.map(copy => ({ ...copy.card, source: 'text:' + copy.id })),
            ];
        },
        matchingCards() {
            const query = this.query.trim().toLocaleLowerCase('fr');
            return this.cards.filter(card => card.title.toLocaleLowerCase('fr').includes(query));
        },
        bySource() {
            return new Map(this.cards.map(card => [card.source, card]));
        },
        defaults() {

            return this.cards.filter(card => card.linked || card.text || card.tags?.length || card.fields?.length)
                .map(card => placement(card.source, card.source));
        },
        initialPlacements() {
            if (this.useDefaults) return this.defaults;
            return this.defaults.filter(item => item.source === this.active);
        },
        displayed() {
            const placements = this.editing ? this.draft : this.placements ?? this.initialPlacements;
            return placements.filter(item => !item.hidden && this.bySource.has(item.source))
                .map(item => {
                    const card = this.bySource.get(item.source);
                    const ordered = this.orderedFields(item, card.fields);
                    const fields = item.hide_empty ? ordered.filter(field => !field.empty) : ordered;
                    return { placement: item, card, fields };
                });
        },
    },
    methods: {
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
            this.draft = this.placements?.map(item => ({ ...item }))
                ?? this.initialPlacements.map(item => placement(item.source));
            this.transfers = [];
            this.copies = [];
            this.editing = true;
        },
        add() {
            this.draft.push(placement(this.source));
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
            const deltas = { ArrowLeft: ['width', -1], ArrowRight: ['width', 1], ArrowUp: ['height', -1], ArrowDown: ['height', 1] };
            const delta = deltas[event.key];
            if (!delta) return;
            event.preventDefault();
            const [dimension, step] = delta;
            item[dimension] = clampSize(item[dimension] + step);
        },
        transfer(index, shared) {
            const item = this.draft[index];
            const copy = shared ? { ...item, id: crypto.randomUUID() } : this.draft.splice(index, 1)[0];
            this.transfers.push({ tab: this.destination, placement: copy });
        },
        createTextBlock() {
            const title = this.newTitle.trim();
            if (!title || this.draft.length >= 80) return;
            const id = crypto.randomUUID();
            const card = { title, text: this.newBody, icon: 'narration' };
            this.copies.push({ id, source: 'blank', title, body: this.newBody, card });
            this.draft.push(placement('text:' + id));
            this.newBody = '';
        },
        duplicate(index) {
            const original = this.draft[index];
            const card = this.bySource.get(original.source);
            const id = crypto.randomUUID();
            this.copies.push({ id, source: original.source, card });
            this.draft.splice(index + 1, 0, { ...original, id: crypto.randomUUID(), source: 'text:' + id });
        },
        cancel() {
            this.copies = [];
            this.editing = false;
        },
        async save() {
            const placed = new Set([...this.draft, ...this.transfers.map(item => item.placement)].map(item => item.source));
            const copies = this.copies.filter(copy => placed.has('text:' + copy.id)).map(({ card, ...copy }) => copy);
            const defaults = this.defaults.filter(item => !this.copies.some(copy => item.source === 'text:' + copy.id))
                .map(item => placement(item.source));
            if (await this.persist(this.draft, this.transfers, defaults, copies)) this.cancel();
        },
    },
};
