<template>
    <div v-if="targets.length">
        <label>Fiche à citer
            <select v-model="selected">
                <option value="">Choisir une fiche</option>
                <option v-for="target in targets" :key="target.public_id" :value="target.public_id">{{ target.title }}</option>
            </select>
        </label>
        <button type="button" :disabled="!selected" @click="insert">Insérer le lien</button>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
    targets: { type: Array, required: true },
});
const emit = defineEmits(['insert']);
const selected = ref('');

function insert() {
    if (!props.targets.some(target => target.public_id === selected.value)) return;
    emit('insert', selected.value);
}
</script>
