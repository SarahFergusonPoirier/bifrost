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
    modelValue: String,
    targets: { type: Array, required: true },
});
const emit = defineEmits(['update:modelValue']);
const selected = ref('');

function insert() {
    if (!props.targets.some(target => target.public_id === selected.value)) return;
    const marker = '[[' + selected.value + ']]';
    emit('update:modelValue', [props.modelValue, marker].filter(Boolean).join(' '));
    selected.value = '';
}
</script>
