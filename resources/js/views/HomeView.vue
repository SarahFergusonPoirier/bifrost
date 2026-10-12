<template>
    <main class="home-view">
        <header class="home-header">
            <div>
                <p class="home-eyebrow">TON ESPACE CRÉATIF</p>
                <h1>Accueil</h1>
                <p class="home-subtitle">
                    Bienvenue dans ton univers de création.
                </p>
            </div>

            <RouterLink
                :to="{ name: 'project-create' }"
                class="button"
            >
                + Nouveau projet
            </RouterLink>
        </header>

        <p v-if="loading" class="home-message">
            Chargement de tes projets…
        </p>

        <section v-else-if="loadError" class="home-message">
            <p class="error">{{ loadError }}</p>
            <RouterLink :to="{ name: 'projects' }">
                Accéder à mes projets
            </RouterLink>
        </section>

        <section
            v-else-if="!featuredProject"
            class="home-empty"
        >
            <div class="home-empty__symbol" aria-hidden="true">
                ✦
            </div>

            <h2>Tout commence par une idée.</h2>

            <p>
                Crée ton premier projet et donne vie à tes idées.
                Tu retrouveras tes projets ici.
            </p>

            <RouterLink
                :to="{ name: 'project-create' }"
                class="button"
            >
                Créer mon premier projet
            </RouterLink>
        </section>

        <template v-else>
            <section class="home-featured-section">
                <div class="home-section-heading">
                    <div>
                        <p class="home-eyebrow">POUR REPRENDRE OÙ TU EN ÉTAIS</p>
                        <h2>Ton projet à la une</h2>
                    </div>
                </div>

                <article class="home-featured-card">
                    <RouterLink
                        :to="{
                            name: 'project-details',
                            params: { id: featuredProject.id }
                        }"
                        class="home-featured-card__cover"
                    >
                        <img
                            v-if="featuredProject.cover_image"
                            :src="`/storage/${featuredProject.cover_image}`"
                            :alt="`Couverture de ${featuredProject.name}`"
                        >

                        <div
                            v-else
                            class="home-cover-placeholder"
                            aria-hidden="true"
                        >
                            <span>✦</span>
                            <span>Ton prochain chef-d’œuvre commence ici</span>
                        </div>
                    </RouterLink>

                    <div class="home-featured-card__content">
                        <p class="home-card-meta">
                            Dernière modification
                            {{
                                formatRelativeDate(
                                    featuredProject.updated_at
                                    || featuredProject.created_at
                                )
                            }}
                        </p>

                        <h3>{{ featuredProject.name }}</h3>

                        <p
                            v-if="featuredProject.description"
                            class="home-featured-card__description"
                        >
                            {{ featuredProject.description }}
                        </p>

                        <p
                            v-else
                            class="home-featured-card__description home-muted"
                        >
                            Aucune description pour ce projet.
                        </p>

                        <div
                            v-if="featuredProject.tags?.length"
                            class="home-tags"
                        >
                            <span
                                v-for="tag in projectTags(featuredProject)"
                                :key="tag.id"
                                class="tag-chip"
                            >
                                {{ tag.name }}
                            </span>

                            <span
                                v-if="remainingTagCount(featuredProject)"
                                class="tag-chip home-tags__more"
                            >
                                +{{ remainingTagCount(featuredProject) }}
                            </span>
                        </div>

                        <RouterLink
                            :to="{
                                name: 'project-details',
                                params: { id: featuredProject.id }
                            }"
                            class="button home-open-button"
                        >
                            Ouvrir le projet
                            <span aria-hidden="true">→</span>
                        </RouterLink>
                    </div>
                </article>
            </section>

            <section class="home-recent-section">
                <div class="home-section-heading">
                    <div>
                        <p class="home-eyebrow">TES DERNIÈRES CRÉATIONS</p>
                        <h2>Activité récente</h2>
                    </div>

                    <RouterLink
                        :to="{ name: 'projects' }"
                        class="home-text-link"
                    >
                        Tous les projets
                        <span aria-hidden="true">→</span>
                    </RouterLink>
                </div>

                <div
                    v-if="recentProjects.length"
                    class="home-recent-grid"
                >
                    <article
                        v-for="project in recentProjects"
                        :key="project.id"
                        class="home-recent-card"
                    >
                        <RouterLink
                            :to="{
                                name: 'project-details',
                                params: { id: project.id }
                            }"
                            class="home-recent-card__link"
                        >
                            <div class="home-recent-card__cover">
                                <img
                                    v-if="project.cover_image"
                                    :src="`/storage/${project.cover_image}`"
                                    :alt="`Couverture de ${project.name}`"
                                    loading="lazy"
                                >

                                <div
                                    v-else
                                    class="home-cover-placeholder"
                                    aria-hidden="true"
                                >
                                    <span>✦</span>
                                </div>
                            </div>

                            <div class="home-recent-card__content">
                                <p class="home-card-meta">
                                    {{
                                        formatRelativeDate(
                                            project.updated_at
                                            || project.created_at
                                        )
                                    }}
                                </p>

                                <h3>{{ project.name }}</h3>

                                <p
                                    v-if="project.description"
                                    class="home-recent-card__description"
                                >
                                    {{ project.description }}
                                </p>

                                <div
                                    v-if="project.tags?.length"
                                    class="home-tags"
                                >
                                    <span
                                        v-for="tag in projectTags(project, 2)"
                                        :key="tag.id"
                                        class="tag-chip"
                                    >
                                        {{ tag.name }}
                                    </span>

                                    <span
                                        v-if="remainingTagCount(project, 2)"
                                        class="tag-chip home-tags__more"
                                    >
                                        +{{ remainingTagCount(project, 2) }}
                                    </span>
                                </div>
                            </div>
                        </RouterLink>
                    </article>
                </div>

                <p v-else class="home-recent-empty">
                    C’est ton seul projet pour le moment.
                    Tes autres projets apparaîtront ici.
                </p>
            </section>
        </template>
    </main>
</template>

<script src="./HomeView.js"></script>