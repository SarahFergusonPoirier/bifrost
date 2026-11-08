<template>
    <p class="fiche-text">{{ truncated ? text.slice(0, limit).trimEnd() + '…' : text }}</p>
    <button v-if="canTruncate" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? 'Voir moins' : 'Voir plus' }}
    </button>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    text: { type: String, required: true },
    limit: { type: Number, default: 320 },
});
const expanded = ref(false);
const canTruncate = computed(() => props.limit > 0 && props.text.length > props.limit);
const truncated = computed(() => !expanded.value && canTruncate.value);
</script>
