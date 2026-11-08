<template>
    <details @toggle="$event.target.open && run(() => {})">
        <summary>Pièces jointes</summary>
        <p v-if="error" role="alert">{{ error }}</p>
        <form @submit.prevent="upload">
            <label>Fichier à joindre (20 Mo maximum) <input ref="file" type="file" required :disabled="busy" /></label>
            <button type="submit" :disabled="busy">Joindre le fichier</button>
        </form>
        <ul>
            <li v-for="attachment in attachments" :key="attachment.public_id">
                <a :href="download(attachment.public_id)">{{ attachment.original_name }}</a>
                <button type="button" :disabled="busy" @click="remove(attachment)">Retirer de la fiche</button>
            </li>
        </ul>
    </details>
</template>

<script src="./ContentAttachments.js"></script>
