<template>
    <div class="project-list">
        <p v-if="loading">
            Chargement des projets…
        </p>

        <p v-else-if="error" class="error">
            {{ error }}
        </p>

        <p v-else-if="projects.length === 0">
            Tu n’as pas encore créé de projet.
        </p>

        <p v-else-if="filteredProjects.length === 0">
            {{ favoritesOnly
                ? 'Tu n’as pas encore de projet favori correspondant aux filtres.'
                : 'Aucun projet ne correspond aux filtres sélectionnés.'
            }}
        </p>

        <div v-else class="project-grid">
            <article
                v-for="project in filteredProjects"
                :key="project.id"
                class="project-card"
            >
                <RouterLink
                    :to="{
                        name: 'project-details',
                        params: { id: project.id }
                    }"
                    class="project-link"
                >
                    <div class="project-card-cover">
                        <img
                            v-if="project.cover_image"
                            :src="`/storage/${project.cover_image}`"
                            :alt="`Couverture du projet ${project.name}`"
                            class="project-card-cover__image"
                            loading="lazy"
                        >

                        <div
                            v-else
                            class="project-card-cover__placeholder"
                            aria-hidden="true"
                        >
                            <span class="project-card-cover__symbol">✦</span>
                            <span>Couverture du projet</span>
                        </div>
                    </div>

                    <h3>{{ project.name }}</h3>

                    <p v-if="project.description">
                        {{ project.description }}
                    </p>
                </RouterLink>

                <button
                    type="button"
                    class="project-favorite-button"
                    :class="{
                        'project-favorite-button--active': project.is_favorite
                    }"
                    :disabled="favoriteLoadingIds.includes(String(project.id))"
                    :aria-pressed="Boolean(project.is_favorite)"
                    :aria-label="project.is_favorite
                        ? `Retirer ${project.name} des favoris`
                        : `Ajouter ${project.name} aux favoris`
                    "
                    :title="project.is_favorite
                        ? 'Retirer des favoris'
                        : 'Ajouter aux favoris'
                    "
                    @click.stop="emitToggleFavorite(project)"
                >
                    <span aria-hidden="true">
                        {{ project.is_favorite ? '★' : '☆' }}
                    </span>
                </button>

                <div
                    v-if="project.tags && project.tags.length"
                    class="project-card-tags"
                >
                    <button
                        v-for="tag in project.tags"
                        :key="tag.id"
                        type="button"
                        class="tag-chip tag-filter-button"
                        @click="selectTag(tag.id)"
                    >
                        {{ tag.name }}
                    </button>
                </div>
            </article>
        </div>
    </div>
</template>

<script src="./ProjectList.js"></script>
