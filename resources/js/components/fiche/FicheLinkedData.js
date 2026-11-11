import { useId } from 'vue';
import { formatTemporalDate } from './formatFieldValue';
import { contentRequest } from '../../services/contentRecovery';

const importance = { major: 0, secondary: 1, minor: 2, unspecified: 3 };
const dateOrder = new Intl.Collator('fr', { numeric: true });

export default {
    props: { path: String, connectionsPath: String, contentId: String, targets: { type: Array, default: () => [] }, kind: { type: String, required: true }, full: Boolean, hasTab: Boolean, sort: String, view: String, localCapabilities: { type: Array, default: () => [] }, localEquipment: { type: Array, default: () => [] } },
    emits: ['open', 'show-all'],
    data() { return { data: this.path ? null : {}, error: '', expanded: false, previewSize: 4, target: '', relationType: '', outgoingLabel: '', incomingLabel: '', savingLink: false, linkError: '', editingLink: null }; },
    setup() {
        return { relationTypeListId: useId() };
    },
    computed: {
        relationTypes() {
            return [...new Set(['famille', 'ami', 'rival', 'mentor', ...(this.data?.relations ?? []).map(relation => relation.type_key).filter(Boolean)])];
        },
        linkType() {
            return { equipment: 'equipment', capabilities: 'capability' }[this.kind] ?? this.relationType.trim();
        },
        items() {
            if (this.kind === 'capabilities') return [...this.localCapabilities, ...(this.data?.capabilities ?? [])];
            if (this.kind === 'equipment') return [...this.localEquipment, ...(this.data?.equipment ?? [])];
            return this.data?.[this.kind] ?? [];
        },
        limit() {
            return this.full || this.expanded ? undefined : this.previewSize;
        },
        events() {
            return this.data.timeline.toSorted((a, b) => {
                if (this.sort === 'importance') {
                    const difference = (importance[a.importance] ?? 3) - (importance[b.importance] ?? 3);
                    if (difference) return difference;
                }

                const start = a.date?.start || a.date?.end;
                const end = b.date?.start || b.date?.end;
                if (!start || !end) return Number(Boolean(end)) - Number(Boolean(start));
                const calendarOrder = dateOrder.compare(a.date.calendar ?? '', b.date.calendar ?? '');
                if (calendarOrder) return calendarOrder;
                const firstOrder = a.date.order == null ? null : Number(a.date.order);
                const secondOrder = b.date.order == null ? null : Number(b.date.order);
                if ((firstOrder === null) !== (secondOrder === null)) return firstOrder === null ? 1 : -1;
                const order = (firstOrder !== null ? firstOrder - secondOrder : 0) || dateOrder.compare(start, end);
                return this.sort === 'recent' ? -order : order;
            });
        },
    },
    mounted() {
        if (this.path) this.load();
    },
    methods: {
        async addLink() {
            if (!this.target || !this.linkType || this.savingLink) return;
            this.savingLink = true;
            this.linkError = '';
            try {
                await contentRequest(this.connectionsPath, 'POST', {
                    source: this.contentId, target: this.target, type_key: this.linkType,
                    ...(this.kind === 'relations' && (this.outgoingLabel.trim() || this.incomingLabel.trim()) ? {
                        properties: {
                            forward_label: this.outgoingLabel.trim() || null,
                            inverse_label: this.incomingLabel.trim() || null,
                        },
                    } : {}),
                });
                this.target = '';
                this.outgoingLabel = '';
                this.incomingLabel = '';
                await this.load();
            } catch (error) {
                this.linkError = error.message;
            } finally {
                this.savingLink = false;
            }
        },
        editLink(entry) {
            this.linkError = '';
            this.editingLink = {
                id: entry.link_id,
                type: entry.type_key,
                forward: entry.forward,
                outgoing: entry.outgoing_label ?? '',
                incoming: entry.incoming_label ?? '',
                role: entry.role ?? '',
                status: entry.status ?? '',
                start: entry.start ?? '',
                end: entry.end ?? '',
                note: entry.note ?? '',
            };
        },
        async saveLink() {
            if (!this.editingLink || this.savingLink) return;
            const { id, type, forward, outgoing, incoming, ...properties } = this.editingLink;
            properties.forward_label = forward ? outgoing : incoming;
            properties.inverse_label = forward ? incoming : outgoing;
            this.savingLink = true;
            this.linkError = '';
            try {
                await contentRequest(this.connectionsPath + '/' + id, 'PUT', {
                    type_key: type.trim(),
                    properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, value.trim() || null])),
                });
                this.editingLink = null;
                await this.load();
            } catch (error) {
                this.linkError = error.message;
            } finally {
                this.savingLink = false;
            }
        },
        async removeLink(entry) {
            if (this.savingLink || !window.confirm('Retirer la relation avec « ' + (entry.title || entry.label) + ' » ?')) return;
            this.savingLink = true;
            this.linkError = '';
            try {
                await contentRequest(this.connectionsPath + '/' + entry.link_id, 'DELETE');
                await this.load();
            } catch (error) {
                this.linkError = error.message;
            } finally {
                this.savingLink = false;
            }
        },
        showAll() {
            if (this.hasTab) this.$emit('show-all', this.kind);
            else this.expanded = !this.expanded;
        },
        async load() {
            this.error = '';
            try {
                const { data } = await contentRequest(this.path);
                this.data = { relations: data?.relations ?? [], timeline: data?.timeline ?? [], equipment: data?.equipment ?? [], capabilities: data?.capabilities ?? [] };
            } catch (error) {
                this.error = error.message;
            }
        },
        formatDate: formatTemporalDate,
    },
};
