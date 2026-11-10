import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    createContentTemplate,
    getContentTemplate,
    getContentTypes,
    getTemplateProjects,
    getTemplateUniverses,
    updateContentTemplate,
} from '../services/contentTemplate';

export default {
    setup() {
        const route = useRoute();
        const router = useRouter();
        const isEditing = computed(() => Boolean(route.params.id));
        const loading = ref(true);
        const saving = ref(false);
        const structureLocked = ref(false);
        const error = ref('');
        const contentTypes = ref([]);
        const projects = ref([]);
        const universes = ref([]);
        const form = reactive({
            name: '',
            description: '',
            content_type_id: '',
            scope_type: 'global',
            project_id: '',
            universe_id: '',
        });

        watch(() => form.scope_type, (scope) => {
            if (scope !== 'project') form.project_id = '';
            if (scope !== 'universe') form.universe_id = '';
        });

        async function loadForm() {
            loading.value = true;
            error.value = '';

            try {
                const [types, projectList, universeList] = await Promise.all([
                    getContentTypes(),
                    getTemplateProjects(),
                    getTemplateUniverses(),
                ]);

                contentTypes.value = types;
                projects.value = projectList;
                universes.value = universeList;

                if (isEditing.value) {
                    const template = await getContentTemplate(route.params.id);
                    structureLocked.value = template.versions?.some(version => Boolean(version.published_at)) ?? false;
                    form.name = template.name;
                    form.description = template.description || '';
                    form.content_type_id = String(template.content_type_id);
                    form.scope_type = template.scope_type;
                    form.project_id = template.project_id ? String(template.project_id) : '';
                    form.universe_id = template.universe_id ? String(template.universe_id) : '';
                }
            } catch (loadError) {
                error.value = loadError.message || 'Impossible de charger le formulaire.';
            } finally {
                loading.value = false;
            }
        }

        async function submitForm() {
            if (saving.value) return;

            saving.value = true;
            error.value = '';

            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                content_type_id: Number(form.content_type_id),
                scope_type: form.scope_type,
                project_id: form.scope_type === 'project' ? Number(form.project_id) : null,
                universe_id: form.scope_type === 'universe' ? Number(form.universe_id) : null,
            };

            try {
                if (isEditing.value) {
                    await updateContentTemplate(route.params.id, payload);
                } else {
                    await createContentTemplate(payload);
                }

                await router.push({ name: 'content-templates' });
            } catch (saveError) {
                error.value = saveError.message || 'Impossible d’enregistrer le modèle.';
            } finally {
                saving.value = false;
            }
        }

        function cancelForm() {
            router.push({ name: 'content-templates' });
        }

        onMounted(loadForm);

        return {
            isEditing,
            loading,
            saving,
            structureLocked,
            error,
            contentTypes,
            projects,
            universes,
            form,
            submitForm,
            cancelForm,
        };
    },
};
