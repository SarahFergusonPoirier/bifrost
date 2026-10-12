import { computed } from 'vue';
import { RouterLink } from 'vue-router';

export default {
    components: {
        RouterLink,
    },

    props: {
        projects: {
            type: Array,
            required: true,
        },
        loading: {
            type: Boolean,
            default: false,
        },
        error: {
            type: String,
            default: '',
        },
        searchQuery: {
            type: String,
            default: '',
        },
        sortOrder: {
            type: String,
            default: 'newest',
        },
        selectedTagIds: {
            type: Array,
            default: () => [],
        },
        tagMatchMode: {
            type: String,
            default: 'or',
        },
    },

    emits: ['select-tag'],

    setup(props, { emit }) {
        const filteredProjects = computed(() => {
            const query = props.searchQuery.trim().toLocaleLowerCase('fr');

            const result = props.projects.filter((project) => {
                const matchesSearch = (project.name || '')
                    .toLocaleLowerCase('fr')
                    .includes(query);

                const projectTagIds = (project.tags || []).map(
                    (tag) => String(tag.id)
                );

                const matchesTag =
                    props.selectedTagIds.length === 0 ||
                    (
                        props.tagMatchMode === 'and'
                            ? props.selectedTagIds.every((id) =>
                                projectTagIds.includes(String(id))
                            )
                            : props.selectedTagIds.some((id) =>
                                projectTagIds.includes(String(id))
                            )
                    );

                return matchesSearch && matchesTag;
            });

            return result.sort((a, b) => {
                switch (props.sortOrder) {
                    case 'oldest':
                        return new Date(a.created_at) - new Date(b.created_at);

                    case 'name-asc':
                        return (a.name || '').localeCompare(b.name || '', 'fr');

                    case 'name-desc':
                        return (b.name || '').localeCompare(a.name || '', 'fr');

                    case 'newest':
                    default:
                        return new Date(b.created_at) - new Date(a.created_at);
                }
            });
        });

        function selectTag(tagId) {
            emit('select-tag', tagId);
        }

        return {
            filteredProjects,
            selectTag,
        };
    },
};