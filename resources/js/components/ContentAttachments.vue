<template>
    <component :is="readOnly ? 'div' : 'details'" @toggle="$event.target.open && run(() => {})">
        <summary v-if="!readOnly">Pièces jointes</summary>
        <p v-if="error" role="alert">{{ error }}</p>
        <form v-if="!readOnly" @submit.prevent="upload">
            <label>Fichier à joindre (20 Mo maximum) <input ref="file" type="file" required :disabled="busy" /></label>
            <button type="submit" :disabled="busy">Joindre le fichier</button>
        </form>
        <p v-if="readOnly && busy" role="status">Chargement…</p>
        <p v-if="readOnly && !busy && !error && !attachments.length">Aucune pièce jointe.</p>
        <ul v-if="attachments.length">
            <li v-for="attachment in attachments" :key="attachment.public_id">
                <a :href="download(attachment.public_id)">{{ attachment.original_name }}</a>
                <button v-if="!readOnly" type="button" :disabled="busy" @click="remove(attachment)">Retirer de la fiche</button>
            </li>
        </ul>
    </component>
</template>

<script src="./ContentAttachments.js"></script>
