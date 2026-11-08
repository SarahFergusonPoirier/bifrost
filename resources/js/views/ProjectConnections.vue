<template>
    <section>
        <h1>Graphes et connexions</h1>
        <p v-if="error" role="alert">{{ error }}</p>
        <fieldset>
            <legend>Filtres du graphe</legend>
            <label>Rechercher une fiche <input v-model="filters.search" type="search" maxlength="255" /></label>
            <label>Type <select v-model="filters.type">
                <option value="">Tous</option>
                <option v-for="[id, type] in types" :key="id" :value="id">{{ type?.name }}</option>
            </select></label>
            <label>Statut <select v-model="filters.status">
                <option value="">Tous</option><option value="draft">Brouillon</option>
                <option value="in_progress">En cours</option><option value="completed">Terminé</option>
                <option value="abandoned">Abandonné</option>
            </select></label>
            <label>Collection <select v-model="filters.folder">
                <option value="">Toutes</option>
                <option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option>
            </select></label>
            <label>Étiquette <select v-model="filters.tag">
                <option value="">Toutes</option>
                <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
            </select></label>
            <label>Relation <select v-model="filters.relation">
                <option value="">Toutes</option>
                <option v-for="relation in relationTypes" :key="relation">{{ relation }}</option>
            </select></label>
            <label>Fiche de départ <select v-model="filters.anchor">
                <option value="">Aucune</option>
                <option v-for="node in nodes" :key="node.id" :value="node.public_id">{{ node.title }}</option>
            </select></label>
            <label>Profondeur <select v-model.number="filters.depth">
                <option :value="0">Sans limite de voisinage</option>
                <option v-for="depth in 10" :key="depth" :value="depth">{{ depth }}</option>
            </select></label>
            <label>Combinaison <select v-model="filters.mode">
                <option value="all">Tous les critères (ET)</option><option value="any">Au moins un critère (OU)</option>
            </select></label>
            <button type="button" @click="resetFilters">Réinitialiser</button>
        </fieldset>
        <details>
            <summary>Vues enregistrées</summary>
            <form @submit.prevent="saveView">
                <label>Nom de la vue <input v-model="viewName" required maxlength="255" /></label>
                <button type="submit" :disabled="busy">Enregistrer ces filtres</button>
            </form>
            <ul>
                <li v-for="view in views" :key="view.id">
                    <button type="button" :disabled="busy" @click="applyView(view)">{{ view.name }}</button>
                    <button type="button" :disabled="busy" @click="deleteView(view)">Supprimer la vue</button>
                </li>
            </ul>
        </details>
        <p v-if="!nodes.length && !busy">Le projet ne contient aucune fiche.</p>
        <p v-else-if="!shown.length && !busy">Aucune fiche ne correspond aux filtres.</p>
        <svg v-else ref="graph" viewBox="0 0 1000 600" preserveAspectRatio="none" width="100%" height="420"
            aria-label="Graphe des fiches" @pointermove="move" @pointerup="finish()" @pointercancel="finish(true)">
            <defs>
                <marker id="connection-arrow" markerWidth="9" markerHeight="9" refX="19" refY="4.5" orient="auto">
                    <path d="M 0 0 L 9 4.5 L 0 9 Z" fill="currentColor" />
                </marker>
            </defs>
            <line v-for="edge in shownEdges" :key="edge.id"
                :x1="edge.source.x * 1000" :y1="edge.source.y * 600" :x2="edge.target.x * 1000" :y2="edge.target.y * 600"
                stroke="currentColor" marker-end="url(#connection-arrow)" />
            <g v-for="node in shown" :key="node.id" :transform="'translate(' + (node.x * 1000) + ' ' + (node.y * 600) + ')'"
                role="button" tabindex="0" :aria-label="node.title" style="touch-action: none; cursor: grab"
                @keydown.enter.prevent="select(node)" @keydown.space.prevent="select(node)" @pointerdown="start($event, node)">
                <circle r="12" :fill="'hsl(' + ((node.content_type_id * 67) % 360) + ' 55% 52%)'"
                    :stroke="selection?.id === node.id ? 'currentColor' : 'none'" stroke-width="3" />
                <text x="16" y="5" fill="currentColor" font-size="15">{{ node.title }}</text>
            </g>
        </svg>
        <section v-if="selection" aria-label="Aperçu de la fiche">
            <h2>{{ selection.title }}</h2>
            <p>{{ selection.content_type?.name }}</p>
            <p v-if="selection.summary">{{ selection.summary }}</p>
            <button type="button" @click="$emit('open-content', selection.public_id)">Ouvrir la fiche</button>
            <h3>Connexions</h3>
            <p v-if="!connections.length">Cette fiche est isolée.</p>
            <ul>
                <li v-for="edge in connections" :key="edge.id">
                    {{ edge.source_content_id === selection.id ? '→' : '←' }} {{ edge.type_key }}
                    <button type="button" @click="select(peer(edge))">{{ peer(edge)?.title }}</button>
                    <button type="button" :disabled="busy" @click="remove(edge)">Retirer</button>
                </li>
            </ul>
            <form @submit.prevent="add">
                <label>Fiche cible
                    <select v-model="target" required>
                        <option value="" disabled>Choisir une fiche</option>
                        <option v-for="node in nodes.filter(item => item.id !== selection.id)" :key="node.id" :value="node.public_id">{{ node.title }}</option>
                    </select>
                </label>
                <label>Type de relation <input v-model="type" required maxlength="80" pattern="[A-Za-z0-9_\-]+" placeholder="ex. appartient_a" /></label>
                <button type="submit" :disabled="busy">Ajouter la relation</button>
            </form>
        </section>
    </section>
</template>

<script src="./ProjectConnections.js"></script>
