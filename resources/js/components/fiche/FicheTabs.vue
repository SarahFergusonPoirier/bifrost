<template>
    <nav class="fiche-tabs" aria-label="Sections de la fiche">
        <button v-for="tab in visibleTabs" :key="tab.id" type="button"
            :aria-pressed="tab.id === active" @click="$emit('select', tab.id)">
            <WorkspaceIcon :name="tab.icon" /> {{ tab.title }}
        </button>
    </nav>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
    <details v-if="layout" class="fiche-tab-settings">
        <summary>Gérer les onglets</summary>
        <form @submit.prevent="save()">
            <fieldset :disabled="saving">
                <legend>Disposition des onglets</legend>
                <div v-for="(tab, index) in tabs" :key="tab.id" class="fiche-tab-settings__row">
                    <label>Titre <input v-model.trim="tab.title" required maxlength="80" /></label>
                    <label>Icône
                        <select v-model="tab.icon">
                            <option v-for="[key, label] in icons" :key="key" :value="key">{{ label }}</option>
                        </select>
                    </label>
                    <label><input v-model="tab.hidden" type="checkbox" /> Masqué</label>
                    <button type="button" :disabled="index === 0" @click="move(index, -1)">Monter</button>
                    <button type="button" :disabled="index === tabs.length - 1" @click="move(index, 1)">Descendre</button>
                    <button type="button" @click="remove(tab)">Supprimer</button>
                </div>
                <button type="button" :disabled="tabs.length >= 24" @click="add()">Ajouter un onglet</button>
                <button v-for="[id, title] in optionalTabs" :key="id" type="button"
                    :disabled="tabs.length >= 24 || tabs.some(tab => tab.id === id)" @click="add(id, title)">{{ title }}</button>
                <button type="submit">Enregistrer la disposition</button>
                <button type="button" @click="reset">Annuler les changements</button>
            </fieldset>
        </form>
    </details>
    <slot :tab="visibleTabs.find(tab => tab.id === active)" :tabs="layout?.tabs ?? visibleTabs"
        :persist="layout && !saving ? (next, transfers, defaults, copies) => savePlacements(next, transfers, defaults, copies) : null" />
</template>

<script src="./FicheTabs.js"></script>
