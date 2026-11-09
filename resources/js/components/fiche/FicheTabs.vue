<template>
    <nav ref="navigation" class="fiche-tabs" @keydown="navigateTabs" aria-label="Sections de la fiche">
        <button v-for="tab in visibleTabs" :key="tab.id" type="button"
            :data-tab="tab.id" :aria-pressed="tab.id === active" @click="$emit('select', tab.id)">
            <WorkspaceIcon :name="tab.icon" /> {{ tab.title }}
        </button>
    </nav>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
    <details v-if="layout" class="fiche-tab-settings">
        <summary>Gérer les onglets</summary>
        <form @submit.prevent="saveTabs">
            <fieldset :disabled="saving">
                <legend>Disposition des onglets</legend>
                <div v-for="(tab, index) in tabs" :key="tab.id" class="fiche-tab-settings__row" role="group" :aria-label="tab.title || 'Nouvel onglet'">
                    <label>Titre <input v-model.trim="tab.title" required maxlength="80" /></label>
                    <label>Icône
                        <select v-model="tab.icon">
                            <option v-for="[key, label] in icons" :key="key" :value="key">{{ label }}</option>
                        </select>
                    </label>
                    <label><input v-model="tab.hidden" type="checkbox" /> Masqué</label>
                    <button type="button" :disabled="index === 0" @click="move(index, -1)" :aria-label="`Monter « ${tab.title} »`">Monter</button>
                    <button type="button" :disabled="index === tabs.length - 1" @click="move(index, 1)" :aria-label="`Descendre « ${tab.title} »`">Descendre</button>
                    <button type="button" @click="requestRemoval(tab)" :aria-label="`Supprimer « ${tab.title} »`">Supprimer</button>
                    <div v-if="removalId === tab.id" class="fiche-tab-removal">
                        <p>Retirer « {{ tab.title }} » de la fiche ?</p>
                        <p>{{ placementsForRemoval(tab).length }} placement(s). Les données enregistrées sont conservées.</p>
                        <label v-if="placementsForRemoval(tab).length">Placements
                            <select v-model="removalDestination">
                                <option :value="null">Retirer les placements</option>
                                <option v-for="target in removalTargets(tab)" :key="target.id" :value="target.id">
                                    Déplacer vers {{ target.title }}
                                </option>
                            </select>
                        </label>
                        <button type="button" @click="remove(tab)">Confirmer la suppression</button>
                        <button type="button" @click="cancelRemoval">Annuler la suppression</button>
                    </div>
                </div>
                <button type="button" :disabled="tabs.length >= 24" @click="add()">Ajouter un onglet</button>
                <button v-for="[id, title] in optionalTabs" :key="id" type="button"
                    :disabled="tabs.length >= 24 || tabs.some(tab => tab.id === id)" @click="add(id, title)">{{ title }}</button>
                <details v-if="templatesPath" @toggle="$event.target.open && loadTemplates()">
                    <summary>Modèles d’onglets</summary>
                    <label>Rechercher un modèle <input v-model="templateQuery" type="search" /></label>
                    <label>Modèle
                        <select v-model="templateId">
                            <option :value="null">Choisir un modèle</option>
                            <option v-for="template in filteredTemplates" :key="template.id" :value="template.id">
                                {{ template.name }} · {{ template.scope === 'global' ? 'Global' : 'Projet' }}
                            </option>
                        </select>
                    </label>
                    <section v-if="selectedTemplate" aria-label="Aperçu du modèle">
                        <p>{{ selectedTemplate.definition.title }} · {{ selectedTemplate.definition.placements.length }} placement(s)</p>
                        <div class="fiche-grid fiche-template-preview">
                            <article v-for="(placement, index) in selectedTemplate.definition.placements" :key="index"
                                class="fiche-block" :style="{ '--fiche-width': placement.width, '--fiche-height': placement.height }">
                                <strong>{{ placementLabel(placement) }}</strong>
                                <p>{{ placement.width }} × {{ placement.height }}</p>
                                <p v-if="placement.hidden">Masqué</p>
                                <p v-else-if="placement.collapsed">Réduit</p>
                            </article>
                        </div>
                    </section>
                    <button type="button" :disabled="!selectedTemplate || tabs.length >= 24" @click="applyTemplate">Ajouter cet onglet à la disposition</button>
                    <label>Nom du modèle <input v-model.trim="templateName" maxlength="80" /></label>
                    <label>Portée
                        <select v-model="templateScope">
                            <option value="project">Ce projet</option>
                            <option value="global">Bibliothèque globale</option>
                        </select>
                    </label>
                    <button type="button" :disabled="!templateName || !layout.version" @click="saveTemplate">Enregistrer l’onglet actif comme modèle</button>
                    <p>Le modèle reprend la disposition enregistrée des blocs réutilisables.</p>
                </details>
                <button type="submit" :disabled="hasPendingText && !canCopy">Enregistrer la disposition</button>
                <button type="button" @click="reset">Annuler les changements</button>
            </fieldset>
        </form>
    </details>
    <details v-if="layout?.version" class="fiche-tab-settings" @toggle="$event.target.open && !revisions && loadRevisions()">
        <summary>Historique des dispositions</summary>
        <button v-if="!revisions" type="button" @click="loadRevisions()">Charger les versions</button>
        <template v-else>
            <p v-if="!revisions.data.length">Aucune disposition antérieure.</p>
            <ul v-else>
                <li v-for="revision in revisions.data" :key="revision.version">
                    Version {{ revision.version }} · {{ revision.tabs.map(tab => tab.title).join(', ') }}
                    <time :datetime="revision.created_at">{{ revision.created_at }}</time>
                    <button type="button" :disabled="saving" @click="restoreRevision(revision)">Restaurer</button>
                </li>
            </ul>
            <button type="button" :disabled="revisions.current_page <= 1" @click="loadRevisions(revisions.current_page - 1)">Page précédente</button>
            <button type="button" :disabled="revisions.current_page >= revisions.last_page" @click="loadRevisions(revisions.current_page + 1)">Page suivante</button>
        </template>
    </details>
    <slot :tab="visibleTabs.find(tab => tab.id === active)" :tabs="layout?.tabs ?? visibleTabs"
        :persist="layout && !saving ? (next, transfers, defaults, copies) => savePlacements(next, transfers, defaults, copies) : null" />
</template>

<script src="./FicheTabs.js"></script>
