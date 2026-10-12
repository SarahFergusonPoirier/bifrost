import { ref, onMounted } from 'vue';
import ProjectList from '../components/projects/ProjectList.vue';
import { useProjects } from '../composables/useProjects';
import { getTags } from '../services/tag';

export default {
    components: {
        ProjectList,
    },

    setup() {
        const searchQuery = ref('');
        const sortOrder = ref('newest');
        const tags = ref([]);
        const selectedTagIds = ref([]);
        const tagMatchMode = ref('or');
        const tagError = ref('');

        const {
            projects,
            loading,
            loadError,
            loadProjects,
        } = useProjects();

        async function loadTags() {
            tagError.value = '';

            try {
                tags.value = await getTags();
            } catch (err) {
                tagError.value =
                    err.message || 'Impossible de charger les tags.';
            }
        }

        function selectTag(tagId) {
            const id = String(tagId);

            const alreadySelected = selectedTagIds.value.some(
                selectedId => String(selectedId) === id
            );

            if (alreadySelected) {
                selectedTagIds.value = selectedTagIds.value.filter(
                    selectedId => String(selectedId) !== id
                );
            } else {
                selectedTagIds.value = [
                    ...selectedTagIds.value,
                    id,
                ];
            }
        }

        function clearTagFilter() {
            selectedTagIds.value = [];
        }

        onMounted(() => {
            loadProjects();
            loadTags();
        });

        return {
            searchQuery,
            sortOrder,
            projects,
            loading,
            loadError,
            tags,
            selectedTagIds,
            tagMatchMode,
            tagError,
            selectTag,
            clearTagFilter,
        };
    },
};