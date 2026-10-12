import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    getProjects,
    updateProject,
    deleteProject,
} from '../services/project';
import ProjectTagInput from '../components/projects/ProjectTagInput.vue';

export default {
    components: {
        ProjectTagInput,
    },

    setup() {
        const route = useRoute();
        const router = useRouter();

        const project = ref(null);
        const loading = ref(true);
        const error = ref('');

        const editing = ref(false);
        const saving = ref(false);
        const saveError = ref('');

        const deleting = ref(false);
        const deleteError = ref('');

        const form = ref({
            name: '',
            description: '',
            tags: [],
        });

        async function loadProject() {
            loading.value = true;
            error.value = '';
            project.value = null;
            editing.value = false;
            deleteError.value = '';

            try {
                const projects = await getProjects();

                project.value = projects.find(
                    (item) => String(item.id) === String(route.params.id)
                );

                if (!project.value) {
                    error.value = 'Projet introuvable.';
                    return;
                }

                form.value = {
                    name: project.value.name,
                    description: project.value.description || '',
                    tags: (project.value.tags || []).map((tag) => tag.name),
                };
            } catch (err) {
                error.value =
                    err.message || 'Impossible de charger le projet.';
            } finally {
                loading.value = false;
            }
        }

        function startEditing() {
            form.value = {
                name: project.value.name,
                description: project.value.description || '',
                tags: (project.value.tags || []).map((tag) => tag.name),
            };

            saveError.value = '';
            editing.value = true;
        }

        function cancelEditing() {
            form.value = {
                name: project.value.name,
                description: project.value.description || '',
                tags: (project.value.tags || []).map((tag) => tag.name),
            };

            saveError.value = '';
            editing.value = false;
        }

        async function handleUpdate() {
            if (saving.value || !project.value) {
                return;
            }

            saving.value = true;
            saveError.value = '';

            try {
                const updatedProject = await updateProject(
                    project.value.id,
                    {
                        name: form.value.name.trim(),
                        description: form.value.description.trim() || null,
                        tags: [...form.value.tags],
                    }
                );

                project.value = updatedProject;
                form.value = {
                    name: updatedProject.name,
                    description: updatedProject.description || '',
                    tags: (updatedProject.tags || []).map((tag) => tag.name),
                };

                editing.value = false;
            } catch (err) {
                saveError.value =
                    err.message || 'Impossible de modifier le projet.';
            } finally {
                saving.value = false;
            }
        }

        async function handleDelete() {
            if (deleting.value || !project.value) {
                return;
            }

            const confirmed = window.confirm(
                `Veux-tu vraiment supprimer le projet « ${project.value.name} » ? Cette action est définitive.`
            );

            if (!confirmed) {
                return;
            }

            deleting.value = true;
            deleteError.value = '';

            try {
                await deleteProject(project.value.id);
                await router.push({ name: 'projects' });
            } catch (err) {
                deleteError.value =
                    err.message || 'Impossible de supprimer le projet.';
            } finally {
                deleting.value = false;
            }
        }

        onMounted(loadProject);

        watch(() => route.params.id, loadProject);

        return {
            project,
            loading,
            error,
            editing,
            saving,
            saveError,
            form,
            startEditing,
            cancelEditing,
            handleUpdate,
            deleting,
            deleteError,
            handleDelete,
        };
    },
};