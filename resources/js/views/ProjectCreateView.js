import { useRouter } from 'vue-router';
import ProjectForm from '../components/projects/ProjectForm.vue';
import { useProjects } from '../composables/useProjects';

export default {
    components: {
        ProjectForm,
    },

    setup() {
        const router = useRouter();

        const {
            saving,
            saveError,
            addProject,
        } = useProjects();

        async function handleCreate(projectData) {
            if (saving.value) {
                return;
            }

            try {
                const project = await addProject(projectData);

                await router.push({
                    name: 'project-details',
                    params: { id: project.id },
                });
            } catch {
                // L'erreur est affichée par le formulaire.
            }
        }

        function cancelCreate() {
            router.push({ name: 'projects' });
        }

        return {
            saving,
            saveError,
            handleCreate,
            cancelCreate,
        };
    },
};