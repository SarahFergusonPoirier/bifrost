<template>
    <button v-if="persist && !editing" type="button" @click="begin">Personnaliser les blocs</button>
    <form v-if="editing" class="fiche-grid-controls" @submit.prevent="save">
        <label>Bloc à afficher
            <select v-model="source">
                <option value="" disabled>Choisir un bloc</option>
                <option v-for="card in cards" :key="card.source" :value="card.source">{{ card.title }}</option>
            </select>
        </label>
        <button type="button" :disabled="!source || draft.length >= 80" @click="add">Ajouter un placement</button>
        <label v-if="destinations.length">Onglet de destination
            <select v-model="destination">
                <option value="">Choisir un onglet</option>
                <option v-for="tab in destinations" :key="tab.id" :value="tab.id">{{ tab.title }}</option>
            </select>
        </label>
        <p v-if="transfers.length" role="status">{{ transfers.length }} transfert(s) à enregistrer.</p>
        <ol>
            <li v-for="(placement, index) in draft" :key="placement.id"
                draggable="true" @dragstart="startDrag($event, index)" @dragover.prevent @drop.prevent="drop(index)" @dragend="dragged = null">
                <strong>{{ bySource.get(placement.source)?.title ?? 'Bloc indisponible' }}</strong>
                <label>Largeur <input v-model.number="placement.width" required type="number" min="1" max="12" /></label>
                <label>Hauteur <input v-model.number="placement.height" required type="number" min="1" max="12" /></label>
                <label><input v-model="placement.hidden" type="checkbox" /> Masqué</label>
                <label><input v-model="placement.collapsed" type="checkbox" /> Réduit</label>
                <button type="button" :disabled="index === 0" @click="move(index, index - 1)">Monter</button>
                <button type="button" :disabled="index === draft.length - 1" @click="move(index, index + 1)">Descendre</button>
                <button v-if="destination" type="button" @click="transfer(index, false)">Déplacer vers l’onglet</button>
                <button v-if="destination" type="button" @click="transfer(index, true)">Afficher aussi (données partagées)</button>
                <button type="button" @click="draft.splice(index, 1)">Retirer</button>
            </li>
        </ol>
        <button type="submit" :disabled="!persist">Enregistrer les blocs</button>
        <button type="button" @click="editing = false">Annuler</button>
    </form>
    <div class="fiche-grid">
        <FicheBlock v-for="{ card, placement } in displayed" :key="placement.id" :title="card.title"
            :icon="card.icon" :style="{ '--fiche-width': placement.width, '--fiche-height': placement.collapsed ? 1 : placement.height }">
            <template v-if="!placement.collapsed">
                <FicheText v-if="card.text" :text="card.text" />
                <ul v-else-if="card.tags?.length" class="fiche-tags">
                    <li v-for="tag in card.tags" :key="tag.id ?? tag.name">{{ tag.name }}</li>
                </ul>
                <dl v-else-if="card.fields?.length" class="fiche-fields">
                    <div v-for="field in card.fields" :key="field.id">
                        <dt>{{ field.label }}</dt>
                        <dd>{{ field.value }}</dd>
                    </div>
                </dl>
                <p v-else>Ce bloc est vide.</p>
            </template>
        </FicheBlock>
        <p v-if="!displayed.length">Aucun bloc visible dans cet onglet.</p>
    </div>
</template>

<script src="./FicheOverview.js"></script>
