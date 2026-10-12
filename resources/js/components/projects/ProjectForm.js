import { ref } from 'vue';
import ProjectTagInput from './ProjectTagInput.vue';

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

        function submitForm() {
            if (props.saving) {
                return;
            }

            emit('submit', {
                name: name.value.trim(),
                description: description.value.trim() || null,
                tags: [...tags.value],
            });
        }

        function cancelForm() {
            emit('cancel');
        }

        return {
            name,
            description,
            tags,
            submitForm,
            cancelForm,
        };
    },
};