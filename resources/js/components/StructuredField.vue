<template>
    <div v-if="format === 'measurement'">
        <label>Valeur <input type="number" step="any" :value="value?.amount ?? ''" @input="update('amount', $event.target.value)" /></label>
        <label>Unité <input :value="value?.unit ?? ''" maxlength="80" @input="update('unit', $event.target.value)" /></label>
    </div>
    <div v-else-if="format === 'coordinates'">
        <label>X <input type="number" step="any" :value="value?.x ?? ''" @input="update('x', $event.target.value)" /></label>
        <label>Y <input type="number" step="any" :value="value?.y ?? ''" @input="update('y', $event.target.value)" /></label>
    </div>
    <div v-else-if="format === 'temporal'">
        <label>Précision
            <select :value="value?.precision ?? ''" @change="update('precision', $event.target.value)">
                <option value="">Non précisée</option>
                <option value="exact">Exacte</option>
                <option value="approximate">Approximative</option>
                <option value="range">Période</option>
                <option value="relative">Relative</option>
                <option value="unknown">Inconnue</option>
            </select>
        </label>
        <label>Date ou repère <input :value="value?.start ?? ''" maxlength="255" @input="update('start', $event.target.value)" /></label>
        <label v-if="value?.precision === 'range' || value?.end">Fin <input :value="value?.end ?? ''" maxlength="255" @input="update('end', $event.target.value)" /></label>
        <label>Calendrier <input :value="value?.calendar ?? ''" maxlength="255" @input="update('calendar', $event.target.value)" /></label>
        <label>
            <input type="checkbox" :checked="Boolean(value?.timeline)" @change="update('timeline', $event.target.checked || '')" />
            Ajouter à la chronologie
        </label>
        <label>Ordre dans le calendrier (facultatif)
            <input type="number" step="1" min="-1000000000" max="1000000000"
                :value="value?.order ?? ''" @input="update('order', $event.target.value)" />
        </label>
        <template v-if="value?.timeline">
            <label>Titre dans la chronologie <input :value="value.timeline_title ?? ''" maxlength="255" @input="update('timeline_title', $event.target.value)" /></label>
            <label>Description <textarea :value="value.timeline_description ?? ''" maxlength="10000" @input="update('timeline_description', $event.target.value)" /></label>
        </template>
    </div>
    <div v-else-if="format === 'external_link'">
        <label>Adresse web <input type="url" maxlength="2048" :value="value?.url ?? ''"
            @change="$emit('change', $event.target.value ? { ...value, url: $event.target.value.trim() } : '')" /></label>
        <label>Libellé <input maxlength="255" :disabled="!value?.url" :value="value?.label ?? ''"
            @change="update('label', $event.target.value.trim())" /></label>
    </div>
    <div v-else-if="['keywords', 'equipment'].includes(format)">
        <ol v-if="value?.length">
            <li v-for="(entry, index) in value" :key="index">
                <label>{{ format === 'equipment' ? 'Nom de l’objet' : 'Mot-clé' }} <input :value="entry.label" required maxlength="120"
                    @change="editKeyword(index, 'label', $event.target.value)" /></label>
                <label>Description <input :value="entry.description ?? ''" maxlength="1000"
                    @change="editKeyword(index, 'description', $event.target.value)" /></label>
                <label v-if="format === 'equipment' && contentId">Image jointe
                    <select :value="entry.image ?? ''" @focus="loadImages" @change="editKeyword(index, 'image', $event.target.value)">
                        <option value="">Aucune image</option>
                        <option v-if="entry.image && !images.some(image => image.public_id === entry.image)" :value="entry.image">Image enregistrée</option>
                        <option v-for="image in images" :key="image.public_id" :value="image.public_id">{{ image.original_name }}</option>
                    </select>
                </label>
                <button type="button" :disabled="index === 0" @click="moveKeyword(index, -1)">Monter</button>
                <button type="button" :disabled="index === value.length - 1" @click="moveKeyword(index, 1)">Descendre</button>
                <button type="button" @click="setKeywords(value.filter((item, i) => i !== index))">Retirer</button>
            </li>
        </ol>
        <p v-if="imageError" role="alert">{{ imageError }}</p>
        <label>{{ format === 'equipment' ? 'Nouvel équipement' : 'Nouveau mot-clé' }} <input v-model="keyword" maxlength="120" @keydown.enter.prevent="addKeyword" /></label>
        <button type="button" :disabled="!keyword.trim() || (value?.length ?? 0) >= 100" @click="addKeyword">Ajouter</button>
    </div>
    <label v-else-if="format === 'scale'">
        Niveau
        <select :value="value?.level ?? ''" @change="update('level', $event.target.value === '' ? '' : Number($event.target.value))">
            <option value="">Non renseigné</option>
            <option v-for="level in levels" :key="level" :value="level">{{ level }} / {{ levels }}</option>
        </select>
    </label>
    <label v-else-if="format === 'references'">
        Fiches liées
        <select multiple :value="value ?? []" @change="updateReferences">
            <option v-for="target in targets" :key="target.public_id" :value="target.public_id" :selected="value?.includes(target.public_id)">{{ target.title }}</option>
            <option v-for="missing in (value ?? []).filter(id => !targets.some(target => target.public_id === id))" :key="missing" :value="missing" selected>Fiche indisponible</option>
        </select>
    </label>
</template>

<script src="./StructuredField.js"></script>
