<template>
    <div class="fiche-text">
        <template v-for="(block, index) in blocks" :key="index">
            <ul v-if="block.type === 'ul'" class="fiche-entry-list">
                <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><FicheInlineText :text="item" /></li>
            </ul>
            <component :is="block.type" v-else><FicheInlineText :text="block.text || ' '" /></component>
        </template>
    </div>
    <button v-if="canTruncate" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? 'Voir moins' : 'Voir plus' }}
    </button>
</template>

<script setup>
import { computed, ref } from 'vue';
import FicheInlineText from './FicheInlineText.vue';
import { textBlocks } from './ficheTextFormat';

const props = defineProps({
    text: { type: String, required: true },
    limit: { type: Number, default: 320 },
});
const expanded = ref(false);
const canTruncate = computed(() => props.limit > 0 && props.text.length > props.limit);
const truncated = computed(() => !expanded.value && canTruncate.value);
const blocks = computed(() => textBlocks(truncated.value ? props.text.slice(0, props.limit).trimEnd() + '…' : props.text));
</script>
