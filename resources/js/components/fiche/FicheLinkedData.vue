<template>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
    <p v-else-if="!data" role="status">Chargement…</p>
    <template v-else-if="kind === 'relations'">
        <ul v-if="data.relations.length">
            <li v-for="relation in data.relations.slice(0, limit)" :key="relation.id">
                <button type="button" @click="$emit('open', relation.public_id)">{{ relation.title }}</button>
                <span> · {{ relation.label }}</span>
                <p v-if="relation.note">{{ relation.note }}</p>
            </li>
        </ul>
        <p v-else>Aucune relation liée à cette fiche.</p>
    </template>
    <template v-else>
        <ol v-if="events.length">
            <li v-for="event in events.slice(0, limit)" :key="event.key">{{ formatDate(event.date) }} · {{ event.title }}</li>
        </ol>
        <p v-else>Aucun événement lié à cette fiche.</p>
    </template>
    <button v-if="data && !full && data[kind].length > previewSize" type="button" :aria-expanded="expanded"
        @click="showAll">{{ expanded ? 'Voir moins' : 'Voir tout' }}</button>
</template>

<script src="./FicheLinkedData.js"></script>
