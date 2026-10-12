import {
    ref,
    onMounted,
    onBeforeUnmount,
    watch,
} from 'vue';

import { useRoute, useRouter } from 'vue-router';

import {
    getProjects,
    updateProject,
    deleteProject,
} from '../services/project';

import ProjectTagInput from '../components/projects/ProjectTagInput.vue';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
        const showDeleteModal = ref(false);
        const deleteConfirmation = ref('');

        const form = ref({
            name: '',
            description: '',
            tags: [],
        });

        const coverImage = ref(null);
        const coverImageInput = ref(null);
        const imagePreviewUrl = ref('');
        const imageError = ref('');
        const removeCoverImage = ref(false);

        function clearImagePreview() {
            if (imagePreviewUrl.value) {
                URL.revokeObjectURL(imagePreviewUrl.value);
                imagePreviewUrl.value = '';
            }
        }

        function clearSelectedImage() {
            coverImage.value = null;
            clearImagePreview();

            if (coverImageInput.value) {
                coverImageInput.value.value = '';
            }
        }

        function resetFormFromProject() {
            if (!project.value) {
                return;
            }

            form.value = {
                name: project.value.name,
                description: project.value.description || '',
                tags: (project.value.tags || []).map(
                    (tag) => tag.name
                ),
            };

            clearSelectedImage();
            removeCoverImage.value = false;
            imageError.value = '';
        }

        async function loadProject() {
            loading.value = true;
            error.value = '';
            project.value = null;
            editing.value = false;
            deleteError.value = '';
            saveError.value = '';
            showDeleteModal.value = false;
            deleteConfirmation.value = '';

            clearSelectedImage();
            removeCoverImage.value = false;
            imageError.value = '';

            try {
                const projects = await getProjects();

                project.value = projects.find(
                    (item) =>
                        String(item.id) === String(route.params.id)
                );

                if (!project.value) {
                    error.value = 'Projet introuvable.';
                    return;
                }

                resetFormFromProject();
            } catch (err) {
                error.value =
                    err.message ||
                    'Impossible de charger le projet.';
            } finally {
                loading.value = false;
            }
        }

        function startEditing() {
            resetFormFromProject();

            saveError.value = '';
            deleteError.value = '';
            editing.value = true;
        }

        function cancelEditing() {
            resetFormFromProject();

            saveError.value = '';
            editing.value = false;
        }

        function openDeleteModal() {
            if (deleting.value || !project.value) {
                return;
            }

            deleteConfirmation.value = '';
            deleteError.value = '';
            showDeleteModal.value = true;
        }

        function closeDeleteModal() {
            if (deleting.value) {
                return;
            }

            showDeleteModal.value = false;
            deleteConfirmation.value = '';
            deleteError.value = '';
        }

        function handleImageChange(event) {
            imageError.value = '';

            const file = event.target.files?.[0] ?? null;

            if (!file) {
                return;
            }

            if (!file.type.startsWith('image/')) {
                clearSelectedImage();
                imageError.value =
                    'Le fichier sélectionné doit être une image.';
                return;
            }

            if (file.size > MAX_IMAGE_SIZE) {
                clearSelectedImage();
                imageError.value =
                    'L’image ne doit pas dépasser 5 Mo.';
                return;
            }

            clearImagePreview();

            coverImage.value = file;
            removeCoverImage.value = false;
            imagePreviewUrl.value = URL.createObjectURL(file);
        }

        function removeImage() {
            imageError.value = '';

            if (removeCoverImage.value) {
                removeCoverImage.value = false;
                return;
            }

            if (coverImage.value) {
                clearSelectedImage();

                removeCoverImage.value =
                    Boolean(project.value?.cover_image);

                return;
            }

            if (project.value?.cover_image) {
                removeCoverImage.value = true;
            }
        }

        async function handleUpdate() {
            if (saving.value || !project.value) {
                return;
            }

            if (imageError.value) {
                return;
            }

            saving.value = true;
            saveError.value = '';

            try {
                const updatedProject = await updateProject(
                    project.value.id,
                    {
                        name: form.value.name.trim(),
                        description:
                            form.value.description.trim() || null,
                        tags: [...form.value.tags],
                        coverImage: coverImage.value,
                        removeCoverImage: removeCoverImage.value,
                    }
                );

                project.value = updatedProject;
                resetFormFromProject();
                editing.value = false;
            } catch (err) {
                saveError.value =
                    err.message ||
                    'Impossible de modifier le projet.';
            } finally {
                saving.value = false;
            }
        }

        async function handleDelete() {
            if (
                deleting.value ||
                !project.value ||
                deleteConfirmation.value !== 'DELETE'
            ) {
                return;
            }

            deleting.value = true;
            deleteError.value = '';

            try {
                await deleteProject(project.value.id);

                await router.push({ name: 'projects' });
            } catch (err) {
                deleteError.value =
                    err.message ||
                    'Impossible de supprimer le projet.';
            } finally {
                deleting.value = false;
            }
        }

        onMounted(loadProject);

        watch(() => route.params.id, loadProject);

        onBeforeUnmount(() => {
            clearImagePreview();
        });

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
            coverImage,
            coverImageInput,
            imagePreviewUrl,
            imageError,
            removeCoverImage,
            handleImageChange,
            removeImage,
            deleting,
            deleteError,
            showDeleteModal,
            deleteConfirmation,
            openDeleteModal,
            closeDeleteModal,
            handleDelete,
        };
    },
};