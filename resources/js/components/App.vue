<template>
    <RouterView v-if="$route.meta.workspace" :key="$route.params.id" />
    <AppLayout v-else>
        <RouterView />
    </AppLayout>
</template>

<script>
import { RouterView } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';

export default {
    components: {
        RouterView,
        AppLayout,
    },
};
</script>
