import FicheBlock from './FicheBlock.vue';
import FicheText from './FicheText.vue';

function clampSize(size) {
    return Math.max(1, Math.min(12, size));
}

function placement(source, id = crypto.randomUUID()) {
    return { id, source, width: 6, height: 2, hidden: false, collapsed: false };
}

export default {
    components: { FicheBlock, FicheText },
    props: {
        summary: String,
        tags: { type: Array, default: () => [] },
        blocks: { type: Array, default: () => [] },
        templateSections: { type: Map, required: true },
        hiddenFields: { type: Array, required: true },
        displayValue: { type: Function, required: true },
        placements: Array,
        persist: Function,
        destinations: { type: Array, default: () => [] },
        useDefaults: { type: Boolean, default: true },
    },
    data: () => ({ editing: false, source: '', draft: [], dragged: null, destination: '', transfers: [], resizing: null }),
    computed: {
        cards() {
            const sections = Array.from(this.templateSections, ([title, fields]) => ({
                source: 'section:' + title,
                title,
                icon: 'catalogue',
                fields: fields.filter(field => !this.hiddenFields.includes(field.field_definition_id)).map(field => ({
                    id: field.id,
                    label: field.label_override || field.field_definition.label,
                    value: this.displayValue(field),
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
                ...sections,
                ...texts,
            ];
        },
        bySource() {
            return new Map(this.cards.map(card => [card.source, card]));
        },
        defaults() {

            return this.cards.filter(card => card.text || card.tags?.length || card.fields?.length)
                .map(card => placement(card.source, card.source));
        },
        displayed() {
            const placements = this.editing ? this.draft : this.placements ?? (this.useDefaults ? this.defaults : []);
            return placements.filter(item => !item.hidden && this.bySource.has(item.source))
                .map(item => ({ placement: item, card: this.bySource.get(item.source) }));
        },
    },
    methods: {
        begin() {
            this.draft = this.placements?.map(item => ({ ...item }))
                ?? (this.useDefaults ? this.defaults.map(item => placement(item.source)) : []);
            this.transfers = [];
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
        async save() {
            if (await this.persist(this.draft, this.transfers, this.defaults.map(item => placement(item.source)))) this.editing = false;
        },
    },
};
