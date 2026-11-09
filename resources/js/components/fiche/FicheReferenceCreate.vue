<template>
    <details v-if="types.length">
        <summary>Créer une fiche liée</summary>
        <p v-if="full">Ce champ contient déjà le maximum de 200 références.</p>
        <fieldset :disabled="busy || full">
            <legend>Nouvelle fiche</legend>
            <label>Nom <input v-model.trim="title" maxlength="255" @keydown.enter.prevent="create" /></label>
            <label>Type
                <select v-model="typeId">
                    <option :value="null">Choisir un type</option>
                    <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
                </select>
            </label>
            <button type="button" :disabled="!title || !typeId" @click="create">Créer et lier</button>
            <p v-if="error" role="alert">{{ error }}</p>
        </fieldset>
    </details>
</template>

<script setup>
import { ref } from 'vue';
import { contentRequest } from '../../services/contentRecovery';

const props = defineProps({ projectId: String, full: Boolean, types: { type: Array, required: true } });
const emit = defineEmits(['created']);
const title = ref('');
const typeId = ref(null);
const busy = ref(false);
const error = ref('');

async function create() {
    if (busy.value || props.full || !title.value || !props.types.some(type => type.id === typeId.value)) return;
    busy.value = true;
    error.value = '';
    try {
        const { data } = await contentRequest('/contents', 'POST', {
            title: title.value, content_type_id: typeId.value, project_id: props.projectId,
        });
        emit('created', data);
        title.value = '';
    } catch (failure) {
        error.value = failure.message;
    } finally {
        busy.value = false;
    }
}
</script>
