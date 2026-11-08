<template>
    <section>
        <h1>Chronologie du projet</h1>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="busy" role="status">Chargement…</p>
        <label>Filtrer par précision
            <select v-model="precision" :disabled="busy" @change="load()">
                <option value="">Toutes</option>
                <option v-for="(label, key) in precisions" :key="key" :value="key">{{ label }}</option>
            </select>
        </label>
        <h2>Dates liées aux fiches</h2>
        <p v-if="source && !source.data.length">Aucune date liée.</p>
        <ul v-else-if="source">
            <li v-for="entry in source.data" :key="entry.key">
                <button type="button" @click="$emit('open-content', entry.content_public_id)">{{ entry.title }}</button>
                <span>{{ dateLabel(entry.date) }}</span>
                <p v-if="entry.description">{{ entry.description }}</p>
            </li>
        </ul>
        <template v-if="source?.last_page > 1">
            <button type="button" :disabled="busy || source.current_page <= 1" @click="load(source.current_page - 1, events.current_page)">Précédent</button>
            <button type="button" :disabled="busy || source.current_page >= source.last_page" @click="load(source.current_page + 1, events.current_page)">Suivant</button>
        </template>
        <h2>Événements sans fiche</h2>
        <form @submit.prevent="save">
            <fieldset :disabled="busy">
                <legend>{{ editing ? 'Modifier l’événement' : 'Ajouter un événement' }}</legend>
                <label>Titre <input v-model="form.title" required maxlength="255" /></label>
                <label>Description <textarea v-model="form.description" maxlength="10000" /></label>
                <label>Précision
                    <select v-model="form.precision">
                        <option v-for="(label, key) in precisions" :key="key" :value="key">{{ label }}</option>
                    </select>
                </label>
                <label>Date ou repère <input v-model="form.start" :required="form.precision !== 'unknown'" maxlength="255" /></label>
                <label>Fin <input v-model="form.end" :required="form.precision === 'range'" maxlength="255" /></label>
                <label>Calendrier <input v-model="form.calendar" maxlength="255" /></label>
                <label>Importance
                    <select v-model="form.importance">
                        <option value="unspecified">Non définie</option>
                        <option value="major">Majeure</option>
                        <option value="secondary">Secondaire</option>
                        <option value="minor">Mineure</option>
                    </select>
                </label>
                <button type="submit">Enregistrer</button>
                <button v-if="editing" type="button" @click="reset">Annuler</button>
            </fieldset>
        </form>
        <ul v-if="events">
            <li v-for="event in events.data" :key="event.id">
                <strong>{{ event.title }}</strong> · {{ dateLabel(event) }}
                <button type="button" :disabled="busy" @click="edit(event)">Modifier</button>
                <button type="button" :disabled="busy" @click="remove(event.id)">Retirer</button>
            </li>
        </ul>
        <template v-if="events?.last_page > 1">
            <button type="button" :disabled="busy || events.current_page <= 1" @click="load(source.current_page, events.current_page - 1)">Précédent</button>
            <button type="button" :disabled="busy || events.current_page >= events.last_page" @click="load(source.current_page, events.current_page + 1)">Suivant</button>
        </template>
    </section>
</template>

<script src="./ProjectTimeline.js"></script>
