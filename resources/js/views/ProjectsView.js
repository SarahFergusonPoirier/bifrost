import { ref, onMounted } from 'vue';
import ProjectList from '../components/projects/ProjectList.vue';
import { useProjects } from '../composables/useProjects';
import { getTags } from '../services/tag';
import { updateProjectFavorite } from '../services/project';

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
        const favoriteError = ref('');
        const favoritesOnly = ref(false);
        const favoriteLoadingIds = ref([]);

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

        async function toggleFavorite(project) {
            const projectId = String(project.id);

            if (favoriteLoadingIds.value.includes(projectId)) {
                return;
            }

            favoriteError.value = '';
            favoriteLoadingIds.value = [
                ...favoriteLoadingIds.value,
                projectId,
            ];

            try {
                const updatedProject = await updateProjectFavorite(
                    project.id,
                    !Boolean(project.is_favorite)
                );

                const index = projects.value.findIndex(
                    item => String(item.id) === projectId
                );

                if (index !== -1) {
                    projects.value[index] = {
                        ...projects.value[index],
                        ...updatedProject,
                        is_favorite: Boolean(updatedProject.is_favorite),
                    };
                }
            } catch (err) {
                favoriteError.value =
                    err.message || 'Impossible de modifier ce favori.';
            } finally {
                favoriteLoadingIds.value =
                    favoriteLoadingIds.value.filter(
                        id => id !== projectId
                    );
            }
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
            favoriteError,
            favoritesOnly,
            favoriteLoadingIds,
            selectTag,
            clearTagFilter,
            toggleFavorite,
        };
    },
};
