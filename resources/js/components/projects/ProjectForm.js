import { ref, onBeforeUnmount } from 'vue';
import ProjectTagInput from './ProjectTagInput.vue';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default {
    components: {
        ProjectTagInput,
    },

    props: {
        saving: {
            type: Boolean,
            default: false,
        },
        error: {
            type: String,
            default: '',
        },
    },

    emits: ['submit', 'cancel'],

    setup(props, { emit }) {
        const name = ref('');
        const description = ref('');
        const tags = ref([]);
        const coverImage = ref(null);
        const imagePreviewUrl = ref('');
        const imageError = ref('');

        function clearImagePreview() {
            if (imagePreviewUrl.value) {
                URL.revokeObjectURL(imagePreviewUrl.value);
                imagePreviewUrl.value = '';
            }
        }

        function handleImageChange(event) {
            imageError.value = '';

            const file = event.target.files?.[0] ?? null;

            if (!file) {
                return;
            }

            if (!file.type.startsWith('image/')) {
                coverImage.value = null;
                clearImagePreview();
                imageError.value = 'Le fichier sélectionné doit être une image.';
                event.target.value = '';
                return;
            }

            if (file.size > MAX_IMAGE_SIZE) {
                coverImage.value = null;
                clearImagePreview();
                imageError.value = 'L’image ne doit pas dépasser 5 Mo.';
                event.target.value = '';
                return;
            }

            clearImagePreview();
            coverImage.value = file;
            imagePreviewUrl.value = URL.createObjectURL(file);
        }

        function removeImage() {
            coverImage.value = null;
            imageError.value = '';
            clearImagePreview();

            const input = document.getElementById('project-cover-image');

            if (input) {
                input.value = '';
            }
        }

        function submitForm() {
            if (props.saving || imageError.value) {
                return;
            }

            emit('submit', {
                name: name.value.trim(),
                description: description.value.trim() || null,
                tags: [...tags.value],
                coverImage: coverImage.value,
            });
        }

        function cancelForm() {
            emit('cancel');
        }

        onBeforeUnmount(() => {
            clearImagePreview();
        });

        return {
            name,
            description,
            tags,
            coverImage,
            imagePreviewUrl,
            imageError,
            handleImageChange,
            removeImage,
            submitForm,
            cancelForm,
        };
    },
};