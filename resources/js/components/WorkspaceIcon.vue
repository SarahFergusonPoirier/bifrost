<template>
    <i class="workspace-icon" :class="'fi-rr-' + icons[name]" aria-hidden="true"></i>
</template>

<script setup>
defineProps({ name: { type: String, required: true } });

const icons = {
    overview: 'home',
    catalogue: 'book-alt',
    connections: 'share',
    timeline: 'clock',
    maps: 'map',
    narration: 'edit',
    ideas: 'bulb',
    search: 'search',
    settings: 'settings',
    project: 'layers',
    folder: 'folder',
    exit: 'exit',
    trash: 'trash',
    archive: 'archive',
};
</script>
