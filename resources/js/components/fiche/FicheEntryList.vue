<template>
    <ul class="fiche-entry-list">
        <li v-for="(entry, index) in entries" :key="entry.id ?? index">
            <ContentAttachments v-if="entry.image && contentId" :content-id="contentId" :image-id="entry.image" gallery single read-only />
            <strong>{{ entry.label }}</strong>
            <span v-if="entry.category"> · {{ entry.category }}</span>
            <span v-if="entry.date"> · {{ formatTemporalDate(entry.date) }}</span>
            <span v-if="entry.period"> · {{ entry.period }}</span>
            <FicheScale v-if="levelMode === 'segments' && entry.rank" :label="entry.label + ' · Niveau'" :level="Number(entry.rank)" :levels="5" mode="segments" />
            <span v-else-if="entry.level"> · {{ entry.level }}</span>
            <FicheScale v-if="entry.mastery" :label="entry.label + ' · Maîtrise'" :level="Number(entry.mastery)" :levels="5" />
            <FicheText v-if="entry.description" :text="entry.description" :limit="textLimit" :resolve-reference="resolveReference" @open="$emit('open', $event)" />
            <FicheEntryFields v-if="entry.fields" :fields="entry.fields" :text-limit="textLimit" :resolve-reference="resolveReference" @open="$emit('open', $event)" />
            <FicheGroupValues v-if="schema.length" :schema="schema" :values="entry.values" :content-id="contentId" :targets="targets"
                :hide-empty="hideEmpty"
                :parent-field-id="parentFieldId" :history-path="[...historyPath, { entry: entry.id }]"
                :resolve-reference="resolveReference" :text-limit="textLimit" @open="$emit('open', $event)" />
        </li>
    </ul>
</template>

<script src="./FicheEntryList.js"></script>
