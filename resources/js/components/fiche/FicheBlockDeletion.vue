<template>
    <details>
        <summary>Vérifier la suppression d’un bloc de texte</summary>
        <label>Bloc
            <select v-model="deletionId" :disabled="deletionBusy" @change="deletionImpact = null; deletionError = ''">
                <option :value="null">Choisir un bloc</option>
                <option v-for="block in blocks.filter(item => item.block_type === 'text')" :key="block.public_id" :value="block.public_id">
                    {{ block.title || 'Texte sans titre' }}
                </option>
            </select>
        </label>
        <button type="button" :disabled="!deletionId || deletionBusy" @click="inspectBlockDeletion">Analyser les dépendances</button>
        <p v-if="deletionError" role="alert">{{ deletionError }}</p>
        <div v-if="deletionImpact">
            <p v-if="deletionImpact.implicit_overview">Le bloc est utilisé dans l’aperçu par défaut.</p>
            <ul v-if="deletionImpact.placements.length">
                <li v-for="item in deletionImpact.placements" :key="item.placement">{{ item.title }}{{ item.hidden ? ' (masqué)' : '' }}</li>
            </ul>
            <p v-if="deletionImpact.historical_versions.length">Dispositions historiques liées · {{ deletionImpact.historical_versions.join(', ') }}</p>
            <template v-if="!deletionImpact.implicit_overview && !deletionImpact.placements.length && !deletionImpact.historical_versions.length">
                <p>Ce bloc n’est utilisé dans aucune disposition. Confirme sa suppression définitive.</p>
                <button type="button" @click="deleteOrphanBlock">Supprimer définitivement ce bloc</button>
            </template>
            <button type="button" @click="deletionImpact = null">Annuler</button>
        </div>
    </details>
</template>

<script src="./FicheBlockDeletion.js"></script>
