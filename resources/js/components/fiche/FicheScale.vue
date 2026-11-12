<template>
    <div class="fiche-scale" role="meter" :aria-label="label" aria-valuemin="1" :aria-valuemax="levels"
        :aria-valuenow="level" :aria-valuetext="descriptions[level - 1] || level + ' / ' + levels"
        :title="mode === 'number' ? descriptions[level - 1] || undefined : undefined">
        <template v-if="mode !== 'number'">
            <span v-for="segment in levels" :key="segment" aria-hidden="true"
                :title="descriptions[segment - 1] || undefined"
                :class="{ 'fiche-scale__filled': segment <= level }" />
        </template>
        <small v-if="mode !== 'segments'" aria-hidden="true">{{ level }} / {{ levels }}</small>
    </div>
    <details v-if="descriptions.slice(0, levels).some(Boolean)">
        <summary :aria-label="'Description des niveaux – ' + label">Description des niveaux</summary>
        <dl>
            <template v-for="(description, index) in descriptions.slice(0, levels)" :key="index">
                <template v-if="description">
                    <dt>Niveau {{ index + 1 }}</dt>
                    <dd>{{ description }}</dd>
                </template>
            </template>
        </dl>
    </details>
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
