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

                    <button type="button" @click="startEditing">
                        Modifier le projet
                    </button>

                    <button
                        type="button"
                        class="button-danger"
                        :disabled="deleting"
                        @click="handleDelete"
                    >
                        {{ deleting ? 'Suppression…' : 'Supprimer le projet' }}
                    </button>

                    <p v-if="deleteError" class="error">
                        {{ deleteError }}
                    </p>
                </template>

                <form v-else @submit.prevent="handleUpdate">
                    <div>
                        <label for="project-name">Nom du projet</label>
                        <input
                            id="project-name"
                            v-model="form.name"
                            type="text"
                            maxlength="255"
                            required
                        />
                    </div>

                    <div>
                        <label for="project-description">Description</label>
                        <textarea
                            id="project-description"
                            v-model="form.description"
                        ></textarea>
                    </div>

                    <ProjectTagInput v-model="form.tags" />

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