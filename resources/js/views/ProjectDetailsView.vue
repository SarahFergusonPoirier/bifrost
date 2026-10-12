
<template>
    <main class="project-details-view">
        <p v-if="loading">
            Chargement du projet…
        </p>

        <p v-else-if="error" class="error">
            {{ error }}
        </p>

        <template v-else-if="project">
            <RouterLink :to="{ name: 'projects' }">
                ← Retour aux projets
            </RouterLink>

            <header class="page-header">
                <template v-if="!editing">
                    <div class="project-card-cover">
                        <img
                            v-if="project.cover_image"
                            :src="`/storage/${project.cover_image}`"
                            :alt="`Couverture du projet ${project.name}`"
                            class="project-card-cover__image"
                        >

                        <div
                            v-else
                            class="project-card-cover__placeholder"
                            aria-hidden="true"
                        >
                            <span class="project-card-cover__symbol">
                                ✦
                            </span>
                            <span>Couverture du projet</span>
                        </div>
                    </div>

                    <h1>{{ project.name }}</h1>

                    <p v-if="project.description">
                        {{ project.description }}
                    </p>

                    <p v-else>
                        Aucune description pour ce projet.
                    </p>

                    <div
                        v-if="project.tags && project.tags.length"
                        class="project-card-tags"
                    >
                        <span
                            v-for="tag in project.tags"
                            :key="tag.id"
                            class="tag-chip"
                        >
                            {{ tag.name }}
                        </span>
                    </div>

                    <button
                        type="button"
                        @click="startEditing"
                    >
                        Modifier le projet
                    </button>

                    <button
                        type="button"
                        class="button-danger"
                        :disabled="deleting"
                        @click="handleDelete"
                    >
                        {{ deleting
                            ? 'Suppression…'
                            : 'Supprimer le projet'
                        }}
                    </button>

                    <p v-if="deleteError" class="error">
                        {{ deleteError }}
                    </p>
                </template>

                <form v-else @submit.prevent="handleUpdate">
                    <div>
                        <label for="project-name">
                            Nom du projet
                        </label>

                        <input
                            id="project-name"
                            v-model="form.name"
                            type="text"
                            maxlength="255"
                            required
                            :disabled="saving"
                        >
                    </div>

                    <div>
                        <label for="project-description">
                            Description
                        </label>

                        <textarea
                            id="project-description"
                            v-model="form.description"
                            :disabled="saving"
                        ></textarea>
                    </div>

                    <div class="project-image-upload">
                        <label for="project-cover-image">
                            Image de couverture (facultatif)
                        </label>

                        <div class="project-image-preview">
                            <img
                                v-if="imagePreviewUrl"
                                :src="imagePreviewUrl"
                                alt="Aperçu de la nouvelle couverture"
                                class="project-image-preview__image"
                            >

                            <img
                                v-else-if="
                                    project.cover_image &&
                                    !removeCoverImage
                                "
                                :src="`/storage/${project.cover_image}`"
                                :alt="`Couverture actuelle de ${project.name}`"
                                class="project-image-preview__image"
                            >

                            <div
                                v-else
                                class="project-image-preview__placeholder"
                                aria-hidden="true"
                            >
                                <span>✦</span>
                                <span>Aucune couverture</span>
                            </div>
                        </div>

                        <input
                            id="project-cover-image"
                            ref="coverImageInput"
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            :disabled="saving"
                            @change="handleImageChange"
                        >

                        <button
                            v-if="coverImage || project.cover_image"
                            type="button"
                            class="button-secondary project-image-remove"
                            :disabled="saving"
                            @click="removeImage"
                        >
                            {{ removeCoverImage
                                ? 'Conserver l’image actuelle'
                                : 'Retirer l’image'
                            }}
                        </button>
                    </div>

                    <ProjectTagInput v-model="form.tags" />

                    <p v-if="imageError" class="error">
                        {{ imageError }}
                    </p>

                    <p v-if="saveError" class="error">
                        {{ saveError }}
                    </p>

                    <button type="submit" :disabled="saving">
                        {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>

                    <button
                        type="button"
                        :disabled="saving"
                        @click="cancelEditing"
                    >
                        Annuler
                    </button>
                </form>
            </header>
        </template>
    </main>
</template>

<script src="./ProjectDetailsView.js"></script>
