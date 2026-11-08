<template>
    <template v-for="(part, index) in parts" :key="index">
        <strong v-if="part.type === 'strong'">{{ part.text }}</strong>
        <a v-else-if="part.type === 'a'" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
        <template v-else-if="part.type === 'reference'">
            <button v-if="resolveReference?.(part.id)" type="button" @click="$emit('open', part.id)">
                {{ part.text || resolveReference(part.id) }}
            </button>
            <span v-else>{{ part.text ? part.text + ' · Fiche indisponible' : 'Fiche indisponible' }}</span>
        </template>
        <template v-else>{{ part.text }}</template>
    </template>
</template>

<script setup>
import { computed } from 'vue';
import { inlineText } from './ficheTextFormat';

const props = defineProps({ text: { type: String, required: true }, resolveReference: Function });
defineEmits(['open']);
const parts = computed(() => inlineText(props.text));
</script>
