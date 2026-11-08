<template>
    <ul class="fiche-tags">
        <li v-for="tag in visible" :key="tag.id ?? tag.name">
            <details v-if="tag.description">
                <summary>{{ tag.name }}</summary>
                <p>{{ tag.description }}</p>
            </details>
            <template v-else>{{ tag.name }}</template>
        </li>
    </ul>
    <button v-if="limited" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? 'Voir moins' : 'Voir tout' }}
    </button>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    tags: { type: Array, required: true },
    limit: { type: Number, default: 0 },
});
const expanded = ref(false);
const limited = computed(() => props.limit > 0 && props.tags.length > props.limit);
const visible = computed(() => limited.value && !expanded.value ? props.tags.slice(0, props.limit) : props.tags);
</script>
