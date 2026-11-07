<template>
    <main class="content-templates-view">
        <header class="page-header">
            <h1>Modèles</h1>
            <p>Des structures réutilisables pour organiser tes contenus.</p>
        </header>

        <section class="content-templates-section">
            <div class="section-heading content-templates-heading">
                <h2>Tous les modèles</h2>
                <RouterLink :to="{ name: 'content-template-create' }" class="button-primary">
                    + Nouveau modèle
                </RouterLink>
            </div>

            <div class="content-template-filters">
                <div class="content-template-search">
                    <label for="template-search">Rechercher</label>
                    <input
                        id="template-search"
                        v-model="searchQuery"
                        type="search"
                        placeholder="Nom du modèle…"
                    />
                </div>

                <div>
                    <label for="template-scope">Portée</label>
                    <select id="template-scope" v-model="scopeFilter">
                        <option value="all">Toutes les portées</option>
                        <option value="global">Globaux</option>
                        <option value="universe">Univers</option>
                        <option value="project">Projets</option>
                    </select>
                </div>

                <div>
                    <label for="template-status">État</label>
                    <select id="template-status" v-model="statusFilter">
                        <option value="active">Actifs</option>
                        <option value="inactive">Désactivés</option>
                        <option value="all">Tous</option>
                    </select>
                </div>
            </div>

            <p v-if="loadError" class="error" role="alert">
                {{ loadError }}
            </p>
            <p v-if="cloneError" class="error" role="alert">
                {{ cloneError }}
            </p>

            <p v-if="loading" class="content-templates-message">
                Chargement des modèles…
            </p>

            <div
                v-else-if="!loadError && templates.length"
                class="content-template-list"
            >
                <article
                    v-for="template in templates"
                    :key="template.id"
                    class="content-template-card"
                >
                    <div class="content-template-card__main">
                        <h3>{{ template.name }}</h3>
                        <p v-if="template.description">
                            {{ template.description }}
                        </p>
                        <span class="content-template-card__context">
                            {{ getScopeContext(template) }}
                        </span>
                    </div>

                    <div class="content-template-card__meta">
                        <span class="content-template-card__type">
                            {{ template.content_type?.name || 'Type inconnu' }}
                        </span>
                        <span class="content-template-card__scope">
                            {{ getScopeLabel(template) }}
                        </span>
                        <span
                            class="content-template-card__status"
                            :class="{
                                'content-template-card__status--inactive': !template.is_active
                            }"
                        >
                            {{ template.is_active ? 'Actif' : 'Désactivé' }}
                        </span>
                        <span
                            v-if="template.versions?.[0] && !template.versions[0].published_at"
                            class="content-template-card__draft"
                        >
                            Brouillon
                        </span>
                        <RouterLink
                            v-if="!template.is_system"
                            :to="{ name: 'content-template-edit', params: { id: template.id } }"
                            class="content-template-card__edit"
                        >
                            Modifier
                        </RouterLink>
                        <button
                            v-if="template.is_system"
                            type="button"
                            class="content-template-card__clone"
                            :disabled="cloningId !== null"
                            @click="cloneTemplate(template)"
                        >
                            {{ cloningId === template.id ? 'Copie…' : 'Personnaliser' }}
                        </button>
                    </div>
                </article>
            </div>

            <div v-else-if="!loadError" class="content-templates-empty">
                <h3>Aucun modèle trouvé</h3>
                <p v-if="hasFilters">
                    Essaie de modifier tes filtres ou ta recherche.
                </p>
                <p v-else>
                    Les modèles disponibles apparaîtront ici.
                </p>
            </div>
        </section>
    </main>
</template>

<script src="./ContentTemplatesView.js"></script>
