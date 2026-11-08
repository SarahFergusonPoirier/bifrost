<template>
    <header class="overview-toolbar">
        <nav aria-label="Fil d’Ariane"><RouterLink :to="{ name: 'projects' }">Projets</RouterLink> › <strong>{{ project?.name ?? 'Projet' }}</strong></nav>
        <form class="overview-search" role="search" @submit.prevent="!busy && $emit('search', query)">
            <label class="project-search-field">
                <WorkspaceIcon name="search" />
                <input ref="search" v-model="query" type="search" aria-label="Rechercher dans le projet" placeholder="Rechercher dans le projet…" maxlength="255" />
            </label>
        </form>
        <details class="overview-menu">
            <summary aria-label="Notifications"><i class="workspace-icon fi-rr-bell" aria-hidden="true"></i></summary>
            <p>Aucune notification.</p>
        </details>
        <details class="overview-menu">
            <summary class="overview-avatar" aria-label="Menu du profil"><i class="workspace-icon fi-rr-user" aria-hidden="true"></i></summary>
            <p>Profil</p>
        </details>
    </header>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import WorkspaceIcon from './WorkspaceIcon.vue';

defineProps({ project: Object, busy: Boolean });
defineEmits(['search']);

const query = ref('');
const search = ref(null);

function focusSearch(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.value.focus();
    }
}

onMounted(() => window.addEventListener('keydown', focusSearch));
onUnmounted(() => window.removeEventListener('keydown', focusSearch));
</script>
