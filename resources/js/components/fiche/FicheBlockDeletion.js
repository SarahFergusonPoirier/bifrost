import { contentRequest } from '../../services/contentRecovery';

export default {
    props: {
        path: { type: String, required: true },
        blocks: { type: Array, required: true },
    },
    emits: ['deleted'],
    data: () => ({ deletionId: null, deletionImpact: null, deletionBusy: false, deletionError: '' }),
    methods: {
        async inspectBlockDeletion() {
            if (!this.deletionId || this.deletionBusy) return;
            this.deletionBusy = true;
            this.deletionImpact = null;
            this.deletionError = '';
            try {
                const { data } = await contentRequest(this.path + '/' + this.deletionId + '/impact');
                this.deletionImpact = data;
            } catch (error) {
                this.deletionError = error.message;
            } finally {
                this.deletionBusy = false;
            }
        },
        async deleteOrphanBlock() {
            const impact = this.deletionImpact;
            if (this.deletionBusy || !impact || impact.implicit_overview
                || impact.placements.length || impact.historical_versions.length) return;

            this.deletionBusy = true;
            this.deletionError = '';
            this.deletionImpact = null;
            try {
                await contentRequest(this.path + '/' + this.deletionId, 'DELETE', {
                    version: impact.version, block_version: impact.block_version, confirmed: true,
                });
                this.deletionId = null;
                this.$emit('deleted');
            } catch (error) {
                this.deletionError = error.message;
            } finally {
                this.deletionBusy = false;
            }
        },
    },
};
