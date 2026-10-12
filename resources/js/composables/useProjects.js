
import { ref } from 'vue';
import {
    getProjects,
    createProject as saveProject,
} from '../services/project';

export function useProjects() {
    const projects = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const loadError = ref('');
    const saveError = ref('');

    async function loadProjects() {
        loading.value = true;
        loadError.value = '';

        try {
            projects.value = await getProjects();
        } catch (err) {
            loadError.value = err.message;
        } finally {
            loading.value = false;
        }
    }

    async function addProject(projectData) {
        saving.value = true;
        saveError.value = '';

        try {
            const project = await saveProject(projectData);
            projects.value.unshift(project);

            return project;
        } catch (err) {
            saveError.value = err.message;
            throw err;
        } finally {
            saving.value = false;
        }
    }

    return {
        projects,
        loading,
        saving,
        loadError,
        saveError,
        loadProjects,
        addProject,
    };
}
