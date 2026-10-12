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
            Aucun projet ne correspond aux filtres sélectionnés.
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
                    <h3>{{ project.name }}</h3>

                    <p v-if="project.description">
                        {{ project.description }}
                    </p>
                </RouterLink>

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