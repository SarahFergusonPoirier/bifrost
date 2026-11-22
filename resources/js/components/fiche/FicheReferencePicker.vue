<template>
    <div v-if="targets.length">
        <label>Fiche à citer
            <select v-model="selected">
                <option value="">Choisir une fiche</option>
                <option v-for="target in targets" :key="target.public_id" :value="target.public_id">{{ target.title }}</option>
            </select>
        </label>
        <button type="button" :disabled="!selected" @click="insert">Insérer le lien</button>
    </div>
</template>

<script src="./FicheReferencePicker.js"></script>
