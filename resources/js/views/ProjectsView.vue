<template>
    <main class="projects-view">
        <header class="page-header">
            <h1>Mes projets</h1>
            <p>Ton espace de création.</p>
        </header>

        <section class="projects-section">
            <div class="section-heading">
                <h2>Projets</h2>

                <button
                    type="button"
                    @click="showForm = !showForm"
                >
                    {{ showForm ? 'Annuler' : '+ Nouveau projet' }}
                </button>
            </div>

            <ProjectForm
                v-if="showForm"
                :saving="saving"
                :error="saveError"
                @submit="handleCreate"
                @cancel="showForm = false"
            />

            <div class="project-filters">
                <div class="project-search">
                    <label for="project-search">
                        Rechercher un projet
                    </label>

                    <input
                        id="project-search"
                        v-model="searchQuery"
                        type="search"
                        placeholder="Nom du projet…"
                    />
                </div>

                <div class="project-sort">
                    <label for="project-sort">Trier par</label>

                    <select id="project-sort" v-model="sortOrder">
                        <option value="newest">Plus récents</option>
                        <option value="oldest">Plus anciens</option>
                        <option value="name-asc">Nom (A à Z)</option>
                        <option value="name-desc">Nom (Z à A)</option>
                    </select>
                </div>

                <div class="project-tag-mode">
                    <label for="tag-match-mode">
                        Correspondance des tags
                    </label>

                    <select id="tag-match-mode" v-model="tagMatchMode">
                        <option value="or">OU — au moins un tag</option>
                        <option value="and">ET — tous les tags</option>
                    </select>
                </div>
            </div>

            <div class="project-tag-filters">
                <span>Filtrer par tags :</span>

                <button
                    type="button"
                    class="tag-chip"
                    :class="{
                        'tag-chip-active': selectedTagIds.length === 0
                    }"
                    @click="clearTagFilter"
                >
                    Tous
                </button>

                <button
                    v-for="tag in tags"
                    :key="tag.id"
                    type="button"
                    class="tag-chip tag-filter-button"
                    :class="{
                        'tag-chip-active': selectedTagIds.some(
                            id => String(id) === String(tag.id)
                        )
                    }"
                    :aria-pressed="selectedTagIds.some(
                        id => String(id) === String(tag.id)
                    )"
                    @click="selectTag(tag.id)"
                >
                    {{ tag.name }}
                </button>
            </div>

            <p v-if="tagError" class="error">
                {{ tagError }}
            </p>

            <ProjectList
                :projects="projects"
                :loading="loading"
                :error="loadError"
                :search-query="searchQuery"
                :sort-order="sortOrder"
                :selected-tag-ids="selectedTagIds"
                :tag-match-mode="tagMatchMode"
                @select-tag="selectTag"
            />
        </section>
    </main>
</template>

<script src="./ProjectsView.js"></script>