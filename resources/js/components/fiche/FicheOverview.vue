<template>
    <button v-if="persist && !editing" type="button" @click="begin">Personnaliser les blocs</button>
    <form v-if="editing" class="fiche-grid-controls" @submit.prevent="save">
        <details open>
            <summary>Bibliothèque de blocs</summary>
            <label>Rechercher un bloc <input v-model="query" type="search" /></label>
            <label>Bloc à afficher
                <select v-model="source">
                    <option value="" disabled>Choisir un bloc</option>
                    <option v-for="card in matchingCards" :key="card.source" :value="card.source">{{ card.title }}</option>
                </select>
            </label>
            <p v-if="source && bySource.has(source)">Aperçu · {{ bySource.get(source).title }}</p>
            <button type="button" :disabled="!source || draft.length >= 80" @click="add">Ajouter un placement</button>
            <fieldset v-if="canCopy">
                <legend>Nouveau bloc de texte</legend>
                <label>Titre <input v-model="newTitle" maxlength="255" list="fiche-text-block-types" /></label>
                <datalist id="fiche-text-block-types">
                    <option value="Texte" />
                    <option value="Biographie" />
                    <option value="Personnalité" />
                    <option value="Résumé" />
                </datalist>
                <label>Texte <textarea v-model="newBody" /></label>
                <button type="button" :disabled="!newTitle.trim() || draft.length >= 80" @click="createTextBlock">Ajouter le bloc</button>
            </fieldset>
        </details>
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
                <label>Titre affiché <input v-model.trim="placement.title" maxlength="80"
                    :placeholder="bySource.get(placement.source)?.title" /></label>
                <label>Icône
                    <select :value="placement.icon ?? ''" @change="placement.icon = $event.target.value || null">
                        <option value="">Par défaut</option>
                        <option v-for="[key, label] in icons" :key="key" :value="key">{{ label }}</option>
                    </select>
                </label>
                <details v-if="bySource.get(placement.source)?.fields?.length">
                    <summary>Champs affichés et disposition</summary>
                    <label>Colonnes internes
                        <select :value="placement.field_columns ?? 1" @change="placement.field_columns = Number($event.target.value)">
                            <option v-for="count in 3" :key="count" :value="count">{{ count }}</option>
                        </select>
                    </label>
                    <template v-for="fields in [bySource.get(placement.source).fields]" :key="placement.source">
                        <ul>
                            <li v-for="(field, fieldIndex) in orderedFields(placement, fields)" :key="field.definitionId">
                                <label><input type="checkbox" checked @change="toggleField(placement, fields, field.definitionId, false)" /> {{ field.label }}</label>
                                <button type="button" :disabled="fieldIndex === 0" :aria-label="'Monter ' + field.label"
                                    @click="moveField(placement, fields, field.definitionId, -1)">↑</button>
                                <button type="button" :disabled="fieldIndex === orderedFields(placement, fields).length - 1" :aria-label="'Descendre ' + field.label"
                                    @click="moveField(placement, fields, field.definitionId, 1)">↓</button>
                            </li>
                            <li v-for="field in fields.filter(item => placement.field_order && !placement.field_order.includes(item.definitionId))" :key="field.definitionId">
                                <label><input type="checkbox" @change="toggleField(placement, fields, field.definitionId, true)" /> {{ field.label }}</label>
                            </li>
                        </ul>
                        <button v-if="placement.field_order" type="button" @click="placement.field_order = null">Rétablir tous les champs</button>
                    </template>
                </details>
                <label v-if="placement.source.startsWith('section:')">
                    <input v-model="placement.hide_empty" type="checkbox" /> Masquer les champs vides
                </label>
                <label v-if="placement.source === 'summary' || placement.source.startsWith('text:')">
                    Longueur de l’aperçu (0 pour tout afficher)
                    <input type="number" min="0" max="5000" :value="placement.text_limit ?? ''"
                        @input="placement.text_limit = $event.target.value === '' ? null : Number($event.target.value)" />
                </label>
                <label v-if="placement.source === 'relations'">Présentation des relations
                    <select :value="placement.view ?? 'list'" @change="placement.view = $event.target.value">
                        <option value="list">Liste compacte</option>
                        <option value="cards">Cartes</option>
                    </select>
                </label>
                <label v-if="placement.source === 'timeline'">Tri de la chronologie
                    <select :value="placement.sort ?? 'chronological'" @change="placement.sort = $event.target.value">
                        <option value="chronological">Ordre chronologique</option>
                        <option value="recent">Dates récentes</option>
                        <option value="importance">Importance</option>
                    </select>
                </label>
                <label><input v-model="placement.hidden" type="checkbox" /> Masqué</label>
                <label><input v-model="placement.collapsed" type="checkbox" /> Réduit</label>
                <button type="button" :disabled="index === 0" @click="move(index, index - 1)">Monter</button>
                <button type="button" :disabled="index === draft.length - 1" @click="move(index, index + 1)">Descendre</button>
                <button v-if="destination" type="button" @click="transfer(index, false)">Déplacer vers l’onglet</button>
                <button v-if="destination" type="button" @click="transfer(index, true)">Afficher aussi (données partagées)</button>
                <button v-if="canCopy && draft.length < 80 && (placement.source === 'summary' || placement.source.startsWith('text:')) && !copies.some(copy => placement.source === 'text:' + copy.id)"
                    type="button" @click="duplicate(index)">Dupliquer indépendamment</button>
                <button type="button" @click="draft.splice(index, 1)">Retirer</button>
            </li>
        </ol>
        <button type="submit" :disabled="!persist || (copies.length > 0 && !canCopy)">Enregistrer les blocs</button>
        <button type="button" @click="cancel">Annuler</button>
    </form>
    <div ref="grid" class="fiche-grid">
        <FicheBlock v-for="{ card, placement, fields } in displayed" :key="placement.id" :title="placement.title || card.title"
            :icon="placement.icon || card.icon" :style="{ '--fiche-width': placement.width, '--fiche-height': placement.collapsed ? 1 : placement.height }">
            <template #actions>
                <button v-if="editing && !placement.collapsed" type="button" class="fiche-resize"
                    :aria-label="'Redimensionner ' + card.title + ' avec les flèches'"
                    @pointerdown="startResize($event, placement)" @pointermove="resize"
                    @pointerup="finishResize" @pointercancel="cancelResize" @lostpointercapture="finishResize"
                    @keydown="resizeWithKeyboard($event, placement)">↘</button>
            </template>
            <template v-if="!placement.collapsed">
                <FicheLinkedData v-if="card.linked" :path="linksPath" :kind="card.source"
                    :sort="placement.sort" :view="placement.view" :full="active === card.source" :has-tab="linkedTabs.includes(card.source)"
                    @open="$emit('open', $event)" @show-all="$emit('select', $event)" />
                <FicheText v-else-if="card.text" :text="card.text" :limit="placement.text_limit ?? undefined" />
                <ul v-else-if="card.tags?.length" class="fiche-tags">
                    <li v-for="tag in card.tags" :key="tag.id ?? tag.name">{{ tag.name }}</li>
                </ul>
                <dl v-else-if="fields?.length" class="fiche-fields" :style="{ '--fiche-field-columns': placement.field_columns ?? 1 }">
                    <div v-for="field in fields" :key="field.id">
                        <dt>{{ field.label }}</dt>
                        <dd>
                            <ul v-if="field.references.length" class="fiche-references">
                                <li v-for="reference in field.references" :key="reference.id">
                                    <button v-if="reference.publicId" type="button" @click="$emit('open', reference.publicId)">{{ reference.title }}</button>
                                    <span v-else>{{ reference.title }}</span>
                                </li>
                            </ul>
                            <div v-else-if="field.scale" class="fiche-scale" role="meter"
                                :aria-label="field.label" aria-valuemin="1" :aria-valuemax="field.scale.levels" :aria-valuenow="field.scale.level">
                                <span v-for="level in field.scale.levels" :key="level" aria-hidden="true"
                                    :class="{ 'fiche-scale__filled': level <= field.scale.level }" />
                                <small aria-hidden="true">{{ field.value }}</small>
                            </div>
                            <template v-else>{{ field.value }}</template>
                        </dd>
                    </div>
                </dl>
                <p v-else>Ce bloc est vide.</p>
            </template>
        </FicheBlock>
        <p v-if="!displayed.length">Aucun bloc visible dans cet onglet.</p>
    </div>
</template>

<script src="./FicheOverview.js"></script>
