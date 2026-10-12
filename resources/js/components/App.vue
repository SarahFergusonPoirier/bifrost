<template>
    <AppLayout>
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
