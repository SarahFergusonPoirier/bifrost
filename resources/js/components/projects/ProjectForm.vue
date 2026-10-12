<template>
    <form class="project-form" @submit.prevent="submitForm">
        <label for="project-name">Nom du projet</label>
        <input
            id="project-name"
            v-model="name"
            required
            maxlength="255"
            placeholder="Ex. Mon univers"
        >

        <label for="project-description">
            Description (facultatif)
        </label>
        <textarea
            id="project-description"
            v-model="description"
            placeholder="Décris ton projet..."
        ></textarea>

        <ProjectTagInput v-model="tags" />

        <p v-if="error" class="error">{{ error }}</p>

        <div class="form-actions">
            <button
                type="button"
                class="button-secondary"
                @click="cancelForm"
            >
                Annuler
            </button>

            <button type="submit" :disabled="saving">
                {{ saving ? 'Enregistrement…' : 'Créer le projet' }}
            </button>
        </div>
    </form>
</template>

<script src="./ProjectForm.js"></script>