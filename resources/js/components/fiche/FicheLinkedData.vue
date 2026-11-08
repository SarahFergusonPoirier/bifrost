<template>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
    <p v-else-if="!data" role="status">Chargement…</p>
    <template v-else-if="kind !== 'timeline'">
        <ul v-if="items.length" class="fiche-relations" :class="{ 'fiche-relations--cards': view === 'cards' }">
            <li v-for="relation in items.slice(0, limit)" :key="relation.id">
                <button v-if="relation.public_id" type="button" @click="$emit('open', relation.public_id)">{{ relation.title }}</button>
                <strong v-else>{{ relation.title }}</strong>
                <span v-if="relation.label" class="fiche-relation-label">{{ relation.label }}</span>
                <template v-if="view === 'cards'">
                    <p v-if="relation.role">{{ relation.role }}</p>
                    <p v-if="relation.start || relation.end">{{ [relation.start, relation.end].filter(Boolean).join(' – ') }}</p>
                    <p v-if="relation.note">{{ relation.note }}</p>
                </template>
            </li>
        </ul>
        <p v-else>{{ kind === 'equipment' ? 'Aucun équipement lié à cette fiche.' : 'Aucune relation liée à cette fiche.' }}</p>
    </template>
    <template v-else>
        <ol v-if="events.length">
            <li v-for="event in events.slice(0, limit)" :key="event.key">{{ formatDate(event.date) }} · {{ event.title }}</li>
        </ol>
        <p v-else>Aucun événement lié à cette fiche.</p>
    </template>
    <button v-if="data && !full && items.length > previewSize" type="button" :aria-expanded="expanded"
        @click="showAll">{{ expanded ? 'Voir moins' : 'Voir tout' }}</button>
</template>

<script src="./FicheLinkedData.js"></script>
