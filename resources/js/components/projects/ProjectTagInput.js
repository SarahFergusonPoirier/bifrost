import { computed, onMounted, ref, watch } from 'vue';
import { getTags, createTag } from '../../services/tag';

export default {
    props: {
        modelValue: {
            type: Array,
            default: () => [],
        },
    },

    emits: ['update:modelValue'],

    setup(props, { emit }) {
        const input = ref('');
        const availableTags = ref([]);
        const loadingTags = ref(false);
        const addingTag = ref(false);
        const error = ref('');
        const showSuggestions = ref(false);

        const selectedTags = computed(() => props.modelValue);

        const matchingTags = computed(() => {
            const query = input.value.trim().toLocaleLowerCase('fr');

            return availableTags.value.filter((tag) => {
                if (selectedTags.value.includes(tag.name)) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                return tag.name
                    .toLocaleLowerCase('fr')
                    .split(/\s+/)
                    .some((word) => word.startsWith(query));
            });
        });

        const exactMatch = computed(() => {
            const query = input.value.trim().toLocaleLowerCase('fr');

            return availableTags.value.find(
                (tag) => tag.name.toLocaleLowerCase('fr') === query
            );
        });

        async function loadTags() {
            loadingTags.value = true;
            error.value = '';

            try {
                availableTags.value = await getTags();
            } catch (err) {
                error.value = err.message || 'Impossible de charger les tags.';
            } finally {
                loadingTags.value = false;
            }
        }

        function selectTag(tag) {
            if (selectedTags.value.includes(tag.name)) {
                input.value = '';
                return;
            }

            emit('update:modelValue', [...selectedTags.value, tag.name]);
            input.value = '';
            error.value = '';
            showSuggestions.value = false;
        }

        async function addTag() {
            const name = input.value.trim();

            if (!name || addingTag.value) {
                return;
            }

            error.value = '';

            if (exactMatch.value) {
                selectTag(exactMatch.value);
                return;
            }

            addingTag.value = true;

            try {
                const tag = await createTag(name);

                if (!availableTags.value.some((item) => item.id === tag.id)) {
                    availableTags.value.push(tag);
                }

                selectTag(tag);
            } catch (err) {
                error.value = err.message || 'Impossible de créer le tag.';
            } finally {
                addingTag.value = false;
            }
        }

        function removeTag(name) {
            emit(
                'update:modelValue',
                selectedTags.value.filter((tag) => tag !== name)
            );
        }

        watch(
            () => props.modelValue,
            (tags) => {
                if (!Array.isArray(tags)) {
                    emit('update:modelValue', []);
                }
            }
        );

        onMounted(loadTags);

        return {
            input,
            availableTags,
            loadingTags,
            addingTag,
            error,
            showSuggestions,
            matchingTags,
            exactMatch,
            selectedTags,
            addTag,
            selectTag,
            removeTag,
        };
    },
};