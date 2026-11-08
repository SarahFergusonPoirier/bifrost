<template>
    <div class="fiche-scale" role="meter" :aria-label="label" aria-valuemin="1" :aria-valuemax="levels"
        :aria-valuenow="level" :aria-valuetext="descriptions[level - 1] || level + ' / ' + levels">
        <template v-if="mode !== 'number'">
            <span v-for="segment in levels" :key="segment" aria-hidden="true"
                :title="descriptions[segment - 1] || undefined"
                :class="{ 'fiche-scale__filled': segment <= level }" />
        </template>
        <small v-if="mode !== 'segments'" aria-hidden="true">{{ level }} / {{ levels }}</small>
    </div>
</template>

<script setup>
defineProps({
    label: { type: String, required: true },
    level: { type: Number, required: true },
    levels: { type: Number, required: true },
    mode: { type: String, default: 'both' },
    descriptions: { type: Array, default: () => [] },
});
</script>
