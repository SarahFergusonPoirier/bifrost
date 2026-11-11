<template>
    <component :is="readOnly ? 'div' : 'details'" @toggle="$event.target.open && run(() => {})">
        <summary v-if="!readOnly">Pièces jointes</summary>
        <p v-if="error" role="alert">{{ error }}</p>
        <form v-if="!readOnly" @submit.prevent="upload">
            <label>Fichier à joindre (20 Mo maximum) <input ref="file" type="file" required :disabled="busy" /></label>
            <label>Texte alternatif (image) <input v-model="alt" maxlength="255" :disabled="busy" /></label>
            <label>Légende facultative <input v-model="caption" maxlength="1000" :disabled="busy" /></label>
            <button type="submit" :disabled="busy">Joindre le fichier</button>
        </form>
        <p v-if="readOnly && busy" role="status">Chargement…</p>
        <template v-if="gallery">
            <label v-if="selectImage && images.length">Image affichée
                <select :value="imageId ?? ''" @change="$emit('select-image', $event.target.value || null)">
                    <option value="">Première image disponible</option>
                    <option v-if="imageId && !images.some(item => item.public_id === imageId)" :value="imageId">Image indisponible</option>
                    <option v-for="image in images" :key="image.public_id" :value="image.public_id">{{ image.original_name }}</option>
                </select>
            </label>
            <div v-if="displayedImages.length" class="fiche-gallery" :class="{ 'fiche-gallery--single': single, 'fiche-gallery--cover': fit === 'cover' }">
                <figure v-for="image in displayedImages" :key="image.public_id">
                    <a :href="download(image.public_id)">
                        <img :src="download(image.public_id) + '/preview'" :alt="image.metadata.alt ?? image.original_name" loading="lazy" />
                    </a>
                    <figcaption v-if="image.metadata.caption">{{ image.metadata.caption }}</figcaption>
                </figure>
            </div>
            <p v-else-if="!busy && !error">Aucune image disponible.</p>
        </template>
        <p v-else-if="readOnly && !busy && !error && !attachments.length">Aucune pièce jointe.</p>
        <ul v-if="!gallery && attachments.length">
            <li v-for="attachment in attachments" :key="attachment.public_id">
                <a :href="download(attachment.public_id)">{{ attachment.original_name }}</a>
                <p v-if="attachment.metadata?.caption">{{ attachment.metadata.caption }}</p>
                <button v-if="!readOnly" type="button" :disabled="busy" @click="remove(attachment)">Retirer de la fiche</button>
            </li>
        </ul>
    </component>
</template>

<script src="./ContentAttachments.js"></script>
