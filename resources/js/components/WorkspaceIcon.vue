<template>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="paths[name]" />
    </svg>
</template>

<script setup>
defineProps({ name: { type: String, required: true } });

const paths = {
    overview: 'M3 10l9-7 9 7 M5 9v12h14V9 M10 21v-7h4v7',
    catalogue: 'M12 6C9 3 5 3 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 1v14',
    connections: 'M9 7l6 8M8 8l-3 7m3 3 8 1 M12 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M22 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    timeline: 'M12 7v5l4 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    maps: 'M2 5l6-3 8 3 6-3v17l-6 3-8-3-6 3z M8 2v17 M16 5v17',
    narration: 'M4 14v6h7 M8 16l2-5L19 2l3 3-9 9z M4 14l3-3',
    ideas: 'M9 19h6m-5 3h4 M8 15a6 6 0 1 1 8 0l-1 2H9z M12 1v1 M2 10h2m16 0h2',
    search: 'M16 16l6 6 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    settings: 'M10 2h4l.5 2.5 2 .8 2.1-1.3 2.4 2.4-1.3 2.1.8 2 2.5.5v3l-2.5.5-.8 2 1.3 2.1-2.4 2.4-2.1-1.3-2 .8L14 23h-4l-.5-2.5-2-.8-2.1 1.3L3 18.6l1.3-2.1-.8-2L1 14v-3l2.5-.5.8-2L3 6.4 5.4 4l2.1 1.3 2-.8z M15 12.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    project: 'M2 8l10-5 10 5-10 5z M2 12l10 5 10-5 M2 16l10 5 10-5',
};
</script>
