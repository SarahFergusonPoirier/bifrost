<template>
    <details v-if="types.length">
        <summary>Créer une fiche liée</summary>
        <p v-if="full">Ce champ contient déjà le maximum de 200 références.</p>
        <fieldset :disabled="busy || full">
            <legend>Nouvelle fiche</legend>
            <label>Nom <input v-model.trim="title" maxlength="255" @keydown.enter.prevent="create" /></label>
            <label>Type
                <select v-model="typeId">
                    <option :value="null">Choisir un type</option>
                    <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
                </select>
            </label>
            <button type="button" :disabled="!title || !typeId" @click="create">Créer et lier</button>
            <p v-if="error" role="alert">{{ error }}</p>
        </fieldset>
    </details>
</template>

<script src="./FicheReferenceCreate.js"></script>
