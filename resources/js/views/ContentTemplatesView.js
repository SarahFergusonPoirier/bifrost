import { computed, onMounted, ref, watch } from 'vue';
import { getContentTemplates } from '../services/contentTemplate';

const scopeLabels = {
    global: 'Global',
    universe: 'Univers',
    project: 'Projet',
};

export default {
    setup() {
        const templates = ref([]);
        const scopeFilter = ref('all');
        const statusFilter = ref('active');
        const searchQuery = ref('');
        const loading = ref(false);
        const loadError = ref('');

        const hasFilters = computed(() =>
            scopeFilter.value !== 'all' ||
            statusFilter.value !== 'active' ||
            searchQuery.value.trim() !== ''
        );

        async function loadTemplates() {
            loading.value = true;
            loadError.value = '';

            try {
                templates.value = await getContentTemplates({
                    scope: scopeFilter.value,
                    status: statusFilter.value,
                    search: searchQuery.value,
                });
            } catch (error) {
                loadError.value =
                    error.message || 'Impossible de charger les modèles.';
            } finally {
                loading.value = false;
            }
        }

        function getScopeLabel(template) {
            return scopeLabels[template.scope_type] || template.scope_type;
        }

        function getScopeContext(template) {
            if (template.scope_type === 'project') {
                return template.project?.name || 'Projet introuvable';
            }

            if (template.scope_type === 'universe') {
                return template.universe?.name || 'Univers introuvable';
            }

            return 'Disponible dans tous les projets';
        }

        watch([scopeFilter, statusFilter], loadTemplates);

        let searchTimeout;
        watch(searchQuery, () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadTemplates, 250);
        });

        onMounted(loadTemplates);

        return {
            templates,
            scopeFilter,
            statusFilter,
            searchQuery,
            loading,
            loadError,
            hasFilters,
            loadTemplates,
            getScopeLabel,
            getScopeContext,
        };
    },
};
