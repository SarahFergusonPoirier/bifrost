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

        <div class="project-image-upload">
            <label for="project-cover-image">
                Image de couverture (facultatif)
            </label>

            <div class="project-image-preview">
                <img
                    v-if="imagePreviewUrl"
                    :src="imagePreviewUrl"
                    alt="Aperçu de la couverture du projet"
                    class="project-image-preview__image"
                >

                <div
                    v-else
                    class="project-image-preview__placeholder"
                    aria-label="Aucune image sélectionnée"
                >
                    <span aria-hidden="true">✦</span>
                    <span>Couverture du projet</span>
                </div>
            </div>

            <input
                id="project-cover-image"
                type="file"
                accept="image/*"
                :disabled="saving"
                @change="handleImageChange"
            >

            <button
                v-if="coverImage"
                type="button"
                class="button-secondary project-image-remove"
                :disabled="saving"
                @click="removeImage"
            >
                Retirer l’image
            </button>
        </div>

        <ProjectTagInput v-model="tags" />

        <p v-if="imageError" class="error">
            {{ imageError }}
        </p>

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