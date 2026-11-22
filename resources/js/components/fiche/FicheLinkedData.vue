<template>
    <component :is="expanded ? 'dialog' : 'div'" ref="fullView"
        :class="expanded ? 'fiche-linked-dialog' : null"
        :aria-label="expanded ? fullViewTitle : null" @close="closeFullView">
        <header v-if="expanded">
            <h2>{{ fullViewTitle }}</h2>
            <form method="dialog">
                <button type="submit" autofocus>Fermer</button>
            </form>
        </header>
        <p v-if="error" role="alert">{{ error }} <button type="button" @click="load">Réessayer</button></p>
        <p v-else-if="!data" role="status">Chargement…</p>
        <template v-else-if="kind !== 'timeline'">
            <ul v-if="items.length" class="fiche-relations" :class="{ 'fiche-relations--cards': view === 'cards' }">
                <li v-for="(relation, index) in items.slice(0, limit)" :key="relation.id ?? index">
                    <slot name="entry" :entry="relation" :detailed="view === 'cards' || showDetails">
                    <img v-if="relation.image && (kind === 'relations' || view === 'cards')"
                        :class="kind === 'relations' ? 'fiche-relation-avatar' : 'fiche-equipment-image'"
                        :src="relation.image" alt="" loading="lazy" @error="$event.target.hidden = true" />
                    <button v-if="relation.public_id" type="button" @click="$emit('open', relation.public_id)">{{ relation.title }}</button>
                    <strong v-else>{{ relation.title }}</strong>
                    <span v-if="relation.label" class="fiche-relation-label">{{ relation.label }}</span>
                    <template v-if="view === 'cards' || showDetails">
                        <p v-if="relation.status">{{ relation.status }}</p>
                        <p v-if="relation.role">{{ relation.role }}</p>
                        <p v-if="relation.start || relation.end">{{ [relation.start, relation.end].filter(Boolean).join(' – ') }}</p>
                        <p v-if="relation.note">{{ relation.note }}</p>
                        <FicheEntryFields :fields="relation.fields" @open="$emit('open', $event)" />
                    </template>
                    </slot>
                    <button v-if="kind === 'relations' && showDetails && connectionsPath && relation.link_id" type="button"
                        :disabled="savingLink || !!editingLink" @click="editLink(relation)">Modifier le lien</button>
                    <button v-if="showDetails && connectionsPath && relation.link_id" type="button" :disabled="savingLink || !!editingLink"
                        @click="removeLink(relation)">Retirer le lien</button>
                </li>
            </ul>
            <p v-else>{{ kind === 'equipment' ? 'Aucun équipement lié à cette fiche.' : kind === 'capabilities' ? 'Aucune capacité.' : 'Aucune relation liée à cette fiche.' }}</p>
        </template>
        <template v-else>
            <ol v-if="events.length">
                <li v-for="event in events.slice(0, limit)" :key="event.key">
                    {{ formatDate(event.date) }} ·
                    <button v-if="event.public_id" type="button" @click="$emit('open', event.public_id)">{{ event.title }}</button>
                    <template v-else>{{ event.title }}</template>
                    <details v-if="showDetails && event.description">
                        <summary>Détails de l’événement</summary>
                        <p>{{ event.description }}</p>
                    </details>
                </li>
            </ol>
            <p v-else>Aucun événement lié à cette fiche.</p>
        </template>
        <form v-if="showDetails && connectionsPath && kind !== 'timeline' && availableTargets.length" @submit.prevent="addLink">
            <fieldset :disabled="savingLink">
                <legend>Lier une fiche</legend>
                <label>Fiche cible
                    <select v-model="target" required>
                        <option value="">Choisir une fiche</option>
                        <option v-for="item in availableTargets" :key="item.public_id" :value="item.public_id">{{ item.title }}</option>
                    </select>
                </label>
                <label v-if="kind === 'relations'">Type de relation
                    <input v-model="relationType" :list="relationTypeListId" required pattern="[A-Za-z0-9_\-]+" maxlength="80" />
                </label>
                <template v-if="kind === 'relations'">
                    <label>Libellé depuis cette fiche <input v-model="outgoingLabel" maxlength="255" /></label>
                    <label>Libellé depuis l’autre fiche <input v-model="incomingLabel" maxlength="255" /></label>
                </template>
                <button type="submit">Créer la relation</button>
            </fieldset>
        </form>
        <form v-if="editingLink" @submit.prevent="saveLink">
            <fieldset :disabled="savingLink">
                <legend>Modifier la relation avec {{ editingLink.title }}</legend>
                <label>Type <input ref="relationTypeEditor" v-model="editingLink.type" :list="relationTypeListId" required pattern="[A-Za-z0-9_\-]+" maxlength="80" /></label>
                <label>Libellé depuis cette fiche <input v-model="editingLink.outgoing" maxlength="255" /></label>
                <label>Libellé depuis l’autre fiche <input v-model="editingLink.incoming" maxlength="255" /></label>
                <label>Statut <input v-model="editingLink.status" maxlength="80" /></label>
                <label>Rôle <input v-model="editingLink.role" maxlength="255" /></label>
                <label>Début <input v-model="editingLink.start" maxlength="255" /></label>
                <label>Fin <input v-model="editingLink.end" maxlength="255" /></label>
                <label>Note <textarea v-model="editingLink.note" maxlength="10000" /></label>
                <button type="submit">Enregistrer la relation</button>
                <button type="button" @click="editingLink = null">Annuler</button>
            </fieldset>
        </form>
        <datalist v-if="kind === 'relations' && showDetails && connectionsPath" :id="relationTypeListId">
            <option v-for="type in relationTypes" :key="type" :value="type" />
        </datalist>
        <p v-if="linkError" role="alert">{{ linkError }}</p>
    </component>
    <button v-if="data && !full && canOpenFullView" ref="showAllButton" type="button"
        :aria-haspopup="hasTab ? null : 'dialog'" @click="showAll">Voir tout</button>
</template>

<script src="./FicheLinkedData.js"></script>
