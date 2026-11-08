<template>
    <details @toggle="$event.target.open && !page && load()">
        <summary>Historique du champ</summary>
        <p v-if="error" role="alert">{{ error }}</p>
        <ol v-if="entries.length">
            <li v-for="entry in entries" :key="entry.id">
                <time :datetime="entry.date">{{ entry.date }}</time> · {{ entry.value }}
            </li>
        </ol>
        <p v-else-if="page && !busy">Aucune valeur antérieure enregistrée.</p>
        <button v-if="!page || page < lastPage" type="button" :disabled="busy" @click="load">
            {{ busy ? 'Chargement…' : page ? 'Révisions précédentes' : 'Charger l’historique' }}
        </button>
    </details>
</template>

<script src="./FicheFieldHistory.js"></script>
