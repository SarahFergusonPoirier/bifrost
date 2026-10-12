import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useProjects } from '../composables/useProjects';

function getProjectDate(project) {
    return new Date(project.updated_at || project.created_at || 0);
}

function formatRelativeDate(dateValue) {
    if (!dateValue) {
        return 'Date inconnue';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return 'Date inconnue';
    }

    const difference = date.getTime() - Date.now();
    const minutes = Math.round(difference / 60000);
    const hours = Math.round(difference / 3600000);
    const days = Math.round(difference / 86400000);

    if (Math.abs(minutes) < 1) {
        return 'À l’instant';
    }

    const formatter = new Intl.RelativeTimeFormat('fr', {
        numeric: 'auto',
    });

    if (Math.abs(minutes) < 60) {
        return formatter.format(minutes, 'minute');
    }

    if (Math.abs(hours) < 24) {
        return formatter.format(hours, 'hour');
    }

    if (Math.abs(days) < 30) {
        return formatter.format(days, 'day');
    }

    const months = Math.round(days / 30);

    if (Math.abs(months) < 12) {
        return formatter.format(months, 'month');
    }

    return formatter.format(Math.round(days / 365), 'year');
}

export default {
    components: {
        RouterLink,
    },

    setup() {
        const {
            projects,
            loading,
            loadError,
            loadProjects,
        } = useProjects();

        const sortedProjects = computed(() => {
            return [...projects.value].sort((a, b) => {
                return getProjectDate(b) - getProjectDate(a);
            });
        });

        const featuredProject = computed(() => {
            return sortedProjects.value[0] ?? null;
        });

        const recentProjects = computed(() => {
            return sortedProjects.value.slice(1, 5);
        });

        function projectTags(project, limit = 3) {
            return (project.tags || []).slice(0, limit);
        }

        function remainingTagCount(project, limit = 3) {
            return Math.max(
                0,
                (project.tags || []).length - limit
            );
        }

        onMounted(() => {
            loadProjects();
        });

        return {
            loading,
            loadError,
            featuredProject,
            recentProjects,
            projectTags,
            remainingTagCount,
            formatRelativeDate,
        };
    },
};