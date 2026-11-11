<template>
    <details @toggle="$event.target.open && load()">
        <summary>Types de relations des univers</summary>
        <p v-if="error" role="alert">{{ error }} <button v-if="universes === null" type="button" @click="load">Réessayer</button></p>
        <p v-if="saved" role="status">{{ saved }}</p>
        <p v-if="busy && universes === null" role="status">Chargement des univers…</p>
        <p v-if="universes?.length === 0">Aucun univers n’est rattaché à ce projet.</p>
        <form v-for="universe in universes" :key="universe.id" @submit.prevent="save(universe)">
            <fieldset :disabled="busy">
                <legend>{{ universe.name }}</legend>
                <label>
                    Un type par ligne, avec des lettres sans accent, des chiffres, des tirets ou des traits de soulignement.
                    <textarea v-model="universe.typesText" rows="4" maxlength="8100" />
                </label>
                <button type="submit">Enregistrer les types</button>
            </fieldset>
        </form>
    </details>
</template>

<script src="./UniverseRelationSettings.js"></script>
