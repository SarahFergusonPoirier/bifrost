<template>
    <button v-if="persist && !editing" ref="editButton" type="button" @click="begin">Personnaliser les blocs</button>
    <form v-if="editing" class="fiche-grid-controls" @submit.prevent="save">
        <details open>
            <summary>Bibliothèque de blocs</summary>
            <label>Rechercher un bloc <input ref="blockSearch" v-model="query" type="search" /></label>
            <label>Bloc à afficher
                <select v-model="source">
                    <option value="" disabled>Choisir un bloc</option>
                    <option v-for="card in matchingCards" :key="card.source" :value="card.source">{{ card.title }}</option>
                </select>
            </label>
            <section v-if="selectedCard" aria-label="Aperçu du bloc">
                <FicheBlock :title="selectedCard.title" :icon="selectedCard.icon">
                    <ul v-if="selectedCard.fields?.length">
                        <li v-for="field in selectedCard.fields.slice(0, 5)" :key="field.id">{{ field.label }}</li>
                    </ul>
                    <p v-else-if="selectedCard.text">{{ selectedCard.text.slice(0, 140) }}</p>
                </FicheBlock>
            </section>
            <p v-if="!matchingCards.length" role="status">Aucun bloc ne correspond à cette recherche.</p>
            <button type="button" :disabled="!selectedCard || draft.length >= 80" @click="add">Ajouter un placement</button>
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
        <details v-if="blockLibraryPath" @toggle="$event.target.open && loadBlockTemplates()">
            <summary>Modèles de blocs enregistrés</summary>
            <p v-if="libraryError" role="alert">{{ libraryError }}</p>
            <label>Modèle de bloc
                <select v-model="blockTemplateId">
                    <option :value="null">Choisir un modèle</option>
                    <option v-for="template in blockTemplates" :key="template.id" :value="template.id">
                        {{ template.name }} · {{ template.scope === 'global' ? 'Global' : 'Projet' }}
                    </option>
                </select>
            </label>
            <div v-if="selectedBlockTemplate" aria-label="Aperçu du modèle de bloc">
                <strong>{{ selectedBlockTemplate.title || bySource.get(selectedBlockTemplate.source)?.title || 'Bloc de texte' }}</strong>
                <p>{{ selectedBlockTemplate.width }} colonnes × {{ selectedBlockTemplate.height }} rangées</p>
                <p v-if="selectedBlockTemplate.source.startsWith('blank:')">Un nouveau texte vide sera créé.</p>
                <p v-else-if="!bySource.has(selectedBlockTemplate.source)" role="status">Le bloc source est indisponible dans cette fiche.</p>
            </div>
            <button type="button" :disabled="!selectedBlockTemplate || draft.length >= 80 || (selectedBlockTemplate.source.startsWith('blank:') ? !canCopy : !bySource.has(selectedBlockTemplate.source))"
                @click="applyBlockTemplate">Ajouter ce modèle</button>
            <fieldset v-if="layoutVersion && placements?.length">
                <legend>Enregistrer un bloc existant comme modèle</legend>
                <label>Bloc enregistré
                    <select v-model="templatePlacementId">
                        <option :value="null">Choisir un bloc</option>
                        <option v-for="item in placements" :key="item.id" :value="item.id">{{ item.title || bySource.get(item.source)?.title || item.source }}</option>
                    </select>
                </label>
                <label>Nom <input v-model="blockTemplateName" maxlength="80" /></label>
                <label>Portée
                    <select v-model="blockTemplateScope"><option value="project">Projet</option><option value="global">Globale</option></select>
                </label>
                <button type="button" :disabled="savingBlockTemplate || !templatePlacementId || !blockTemplateName.trim()" @click="saveBlockTemplate">Enregistrer le modèle de bloc</button>
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
                <label>Largeur en colonnes <input v-model.number="placement.width" required type="number" min="1" max="12" /></label>
                <label>Hauteur en rangées <input v-model.number="placement.height" required type="number" min="1" max="12" /></label>
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
                <label v-if="placement.source === 'fields' || placement.source.startsWith('section:')">
                    <input v-model="placement.hide_empty" type="checkbox" /> Masquer les champs vides
                </label>
                <label v-if="placement.source === 'summary' || placement.source.startsWith('text:')">
                    Longueur de l’aperçu (0 pour tout afficher)
                    <input type="number" min="0" max="5000" :value="placement.text_limit ?? ''"
                        @input="placement.text_limit = $event.target.value === '' ? null : Number($event.target.value)" />
                </label>
                <label v-if="placement.source === 'tags'">Nombre de pastilles par liste (0 pour toutes)
                    <input type="number" min="0" max="100" required :value="placement.tag_limit ?? 0"
                        @change="placement.tag_limit = Number($event.target.value)" />
                </label>
                <label v-if="placement.source === 'capabilities'">Affichage de la maîtrise
                    <select :value="placement.mastery_view ?? 'badge'" @change="placement.mastery_view = $event.target.value">
                        <option value="badge">Badge</option>
                        <option value="segments">Échelle segmentée</option>
                        <option value="hidden">Masqué</option>
                    </select>
                </label>
                <label v-if="placement.source === 'gallery'">Présentation des images
                    <select :value="placement.media_mode ?? 'gallery'" @change="placement.media_mode = $event.target.value">
                        <option value="gallery">Galerie</option>
                        <option value="single">Image unique</option>
                    </select>
                </label>
                <label v-if="placement.source === 'gallery' && placement.media_mode !== 'single'">Cadrage des miniatures
                    <select :value="placement.media_fit ?? 'contain'" @change="placement.media_fit = $event.target.value">
                        <option value="contain">Image entière</option>
                        <option value="cover">Remplir la miniature</option>
                    </select>
                </label>
                <label v-if="['relations', 'equipment'].includes(placement.source)">Présentation de la liste
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
                <button type="button" :disabled="index === 0" @click="move(index, index - 1)" :aria-label="'Monter ' + (placement.title || bySource.get(placement.source)?.title || 'le bloc')">Monter</button>
                <button type="button" :disabled="index === draft.length - 1" @click="move(index, index + 1)" :aria-label="'Descendre ' + (placement.title || bySource.get(placement.source)?.title || 'le bloc')">Descendre</button>
                <button v-if="destination" type="button" @click="transfer(index, false)">Déplacer vers l’onglet</button>
                <button v-if="destination" type="button" @click="transfer(index, true)">Afficher aussi (données partagées)</button>
                <button v-if="canCopy && draft.length < 80 && (placement.source === 'summary' || placement.source.startsWith('text:')) && bySource.has(placement.source) && !copies.some(copy => placement.source === 'text:' + copy.id)"
                    type="button" @click="duplicate(index)">Dupliquer indépendamment</button>
                <button type="button" @click="draft.splice(index, 1)" :aria-label="'Retirer ' + (placement.title || bySource.get(placement.source)?.title || 'le bloc')">Retirer</button>
            </li>
        </ol>
        <div class="fiche-grid-actions">
            <button type="submit" :disabled="!persist || (copies.length > 0 && !canCopy)">Enregistrer les blocs</button>
            <button type="button" @click="cancel">Annuler</button>
        </div>
    </form>
    <div ref="grid" class="fiche-grid">
        <FicheBlock v-for="{ card, placement, fields } in displayed" :key="placement.id" :title="placement.title || card.title"
            :icon="placement.icon || card.icon" :style="{ '--fiche-width': placement.width, '--fiche-height': placement.collapsed ? 1 : placement.height }">
            <template #actions>
                <small v-if="sharedSources.has(placement.source)" class="fiche-shared-label">Données partagées</small>
                <button v-if="editing && !placement.collapsed" type="button" class="fiche-resize"
                    :aria-label="'Redimensionner ' + card.title + ' avec les flèches'"
                    @pointerdown="startResize($event, placement)" @pointermove="resize"
                    @pointerup="finishResize" @pointercancel="cancelResize" @lostpointercapture="finishResize"
                    @keydown="resizeWithKeyboard($event, placement)">↘</button>
            </template>
            <template v-if="!placement.collapsed">
                <FicheLinkedData v-if="card.linked" :path="linksPath" :kind="card.source" :local-equipment="localEquipment" :connections-path="connectionsPath" :content-id="contentId"
                    :targets="card.source === 'equipment' ? referenceTargets.filter(item => item.content_type_id === equipmentType) : referenceTargets"
                    :sort="placement.sort" :view="placement.view" :full="active === card.source" :has-tab="linkedTabs.includes(card.source)"
                    @open="$emit('open', $event)" @show-all="$emit('select', $event)" />
                <ContentAttachments v-else-if="['attachments', 'gallery'].includes(card.source)" :content-id="contentId" :gallery="card.source === 'gallery'" :single="placement.media_mode === 'single'" :image-id="placement.media_image" :fit="placement.media_fit"
                    :select-image="editing && placement.media_mode === 'single'"
                    @select-image="placement.media_image = $event" read-only />
                <FicheLinkedData v-else-if="card.source === 'capabilities'" :path="linksPath" kind="capabilities"
                    :local-capabilities="card.entries" :connections-path="connectionsPath" :content-id="contentId" :targets="referenceTargets" view="cards" :full="active === 'capabilities'"
                    :has-tab="linkedTabs.includes('capabilities')" @show-all="$emit('select', $event)">
                    <template #entry="{ entry }">
                        <button v-if="entry.public_id" type="button" @click="$emit('open', entry.public_id)">{{ entry.label }}</button>
                        <strong v-else>{{ entry.label }}</strong>
                        <span v-if="entry.category" class="fiche-relation-label">{{ entry.category }}</span>
                        <FicheScale v-if="entry.mastery && placement.mastery_view === 'segments'"
                            label="Maîtrise" :level="Number(entry.mastery)" :levels="5" mode="segments" />
                        <span v-else-if="entry.mastery && placement.mastery_view !== 'hidden'" class="fiche-choice-badge">
                            Maîtrise · {{ entry.mastery }} / 5
                        </span>
                        <FicheText v-if="entry.description" :text="entry.description" :resolve-reference="resolveReference" @open="$emit('open', $event)" />
                    </template>
                </FicheLinkedData>
                <FicheText v-else-if="card.text" :text="card.text" :limit="placement.text_limit ?? undefined" :resolve-reference="resolveReference" @open="$emit('open', $event)" />
                <template v-else-if="card.source === 'tags'">
                    <section v-if="card.tags.length">
                        <h3>Étiquettes du projet</h3>
                        <FicheTags :tags="card.tags" :limit="placement.tag_limit" />
                    </section>
                    <section v-if="card.keywords.length">
                        <h3>Mots-clés libres</h3>
                        <FicheTags :tags="card.keywords" :limit="placement.tag_limit" />
                    </section>
                    <p v-if="!card.tags.length && !card.keywords.length">Aucune étiquette ni mot-clé.</p>
                </template>
                <dl v-else-if="fields?.length || card.fullName" class="fiche-fields" :style="{ '--fiche-field-columns': placement.field_columns ?? 1 }">
                    <div v-if="card.fullName">
                        <dt>Nom complet</dt>
                        <dd>{{ card.fullName }}</dd>
                    </div>
                    <div v-for="field in fields" :key="field.id">
                        <dt>{{ field.label }}</dt>
                        <dd>
                            <ul v-if="field.references.length" class="fiche-references">
                                <li v-for="reference in field.references" :key="reference.id">
                                    <button v-if="reference.publicId" type="button" @click="$emit('open', reference.publicId)">{{ reference.title }}</button>
                                    <span v-else>{{ reference.title }}</span>
                                </li>
                            </ul>
                            <ul v-else-if="field.entries?.length" class="fiche-entry-list">
                                <li v-for="(entry, index) in field.entries" :key="index">
                                    <strong>{{ entry.label }}</strong>
                                    <span v-if="entry.period"> · {{ entry.period }}</span>
                                    <FicheScale v-if="field.levelMode === 'segments' && entry.rank"
                                        :label="entry.label + ' · Niveau'" :level="Number(entry.rank)" :levels="5" mode="segments" />
                                    <span v-else-if="entry.level"> · {{ entry.level }}</span>
                                    <FicheText v-if="entry.description" :text="entry.description" :resolve-reference="resolveReference" @open="$emit('open', $event)" />
                                </li>
                            </ul>
                            <ul v-else-if="field.keywords?.length" class="fiche-tags">
                                <li v-for="(keyword, index) in field.keywords" :key="index">
                                    <details v-if="keyword.description">
                                        <summary>{{ keyword.label }}</summary>
                                        <p>{{ keyword.description }}</p>
                                    </details>
                                    <template v-else>{{ keyword.label }}</template>
                                </li>
                            </ul>
                            <div v-else-if="field.scale">
                                <FicheScale :label="field.label" :level="Number(field.scale.level)" :levels="field.scale.levels"
                                    :mode="field.scale.mode" :descriptions="field.scale.descriptions" />
                                <details v-if="field.scale.descriptions.some(Boolean)">
                                    <summary>Descriptions des niveaux</summary>
                                    <ol>
                                        <li v-for="(description, index) in field.scale.descriptions" :key="index">{{ description || 'Sans description' }}</li>
                                    </ol>
                                </details>
                            </div>
                            <a v-else-if="field.url" :href="field.url" target="_blank" rel="noopener noreferrer">{{ field.value }}</a>
                            <span v-else-if="field.badgeColor" class="fiche-choice-badge" :data-color="field.badgeColor">{{ field.value }}</span>
                            <template v-else>{{ field.value }}</template>
                            <FicheFieldHistory v-if="contentId && field.historyField && formatHistoricalValue"
                                :content-id="contentId" :field="field.historyField" :format-value="formatHistoricalValue" />
                        </dd>
                    </div>
                </dl>
                <p v-else-if="card.unavailable">La source de ce placement est indisponible.</p>
                <p v-else>Ce bloc est vide.</p>
            </template>
        </FicheBlock>
        <p v-if="!displayed.length">Aucun bloc visible dans cet onglet.</p>
    </div>
</template>

<script src="./FicheOverview.js"></script>
