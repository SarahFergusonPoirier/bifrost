<template>
    <article class="fiche-block">
        <header class="fiche-block__header">
            <WorkspaceIcon :name="icon" />
            <h2>{{ title }}</h2>
            <slot name="actions" />
        </header>
        <slot />
    </article>
</template>

<script setup>
import WorkspaceIcon from '../WorkspaceIcon.vue';

defineProps({
    title: { type: String, required: true },
    icon: { type: String, default: 'catalogue' },
});
</script>
