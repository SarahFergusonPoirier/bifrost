import { ref, onMounted } from 'vue';
import ProjectForm from '../components/projects/ProjectForm.vue';
import ProjectList from '../components/projects/ProjectList.vue';
import { useProjects } from '../composables/useProjects';
import { getTags } from '../services/tag';

export default {
    components: {
        ProjectForm,
        ProjectList,
    },

    setup() {
        const showForm = ref(false);
        const searchQuery = ref('');
        const sortOrder = ref('newest');
        const tags = ref([]);
        const selectedTagIds = ref([]);
        const tagMatchMode = ref('or');
        const tagError = ref('');

        const {
            projects,
            loading,
            saving,
            loadError,
            saveError,
            loadProjects,
            addProject,
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

        async function handleCreate(projectData) {
            if (saving.value) {
                return;
            }

            try {
                await addProject(projectData);
                showForm.value = false;
                await loadTags();
            } catch {
                // L'erreur est déjà gérée par useProjects.
            }
        }

        function selectTag(tagId) {
            const id = String(tagId);

            const alreadySelected = selectedTagIds.value.some(
                (selectedId) => String(selectedId) === id
            );

            if (alreadySelected) {
                selectedTagIds.value = selectedTagIds.value.filter(
                    (selectedId) => String(selectedId) !== id
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
            showForm,
            searchQuery,
            sortOrder,
            projects,
            loading,
            saving,
            loadError,
            saveError,
            handleCreate,
            tags,
            selectedTagIds,
            tagMatchMode,
            tagError,
            selectTag,
            clearTagFilter,
        };
    },
};