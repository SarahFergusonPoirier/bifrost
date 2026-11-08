<template>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
    <p v-else-if="!data" role="status">Chargement…</p>
    <FicheBlock v-else-if="kind === 'relations'" title="Relations" icon="connections">
        <ul v-if="data.relations.length">
            <li v-for="relation in data.relations" :key="relation.id">
                <button type="button" @click="$emit('open', relation.public_id)">{{ relation.title }}</button>
                <span> · {{ relation.label }}</span>
                <p v-if="relation.note">{{ relation.note }}</p>
            </li>
        </ul>
        <p v-else>Aucune relation liée à cette fiche.</p>
    </FicheBlock>
    <FicheBlock v-else title="Chronologie" icon="timeline">
        <ol v-if="events.length">
            <li v-for="event in events" :key="event.key">{{ formatDate(event.date) }} · {{ event.title }}</li>
        </ol>
        <p v-else>Aucun événement lié à cette fiche.</p>
    </FicheBlock>
</template>

<script src="./FicheLinkedData.js"></script>
