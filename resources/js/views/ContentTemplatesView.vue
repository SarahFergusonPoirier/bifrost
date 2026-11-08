<template>
    <main class="content-templates-view">
        <header class="page-header">
            <h1>Modèles</h1>
            <p>Des structures réutilisables pour organiser tes contenus.</p>
        </header>

        <section class="content-templates-section">
            <div class="section-heading">
                <h2>Tous les modèles</h2>
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
                    </div>
                    <details @toggle="$event.target.open && loadDetails(template.id)">
                        <summary>Voir les versions et les champs</summary>
                        <p v-if="details[template.id]?.loading">Chargement…</p>
                        <p v-if="details[template.id]?.error" role="alert">{{ details[template.id].error }}</p>
                        <p v-if="details[template.id]?.versions?.length === 0">Aucune version publiée.</p>
                        <details v-for="version in details[template.id]?.versions" :key="version.id">
                            <summary>Version {{ version.version_number }}</summary>
                            <ul>
                                <li v-for="field in version.fields" :key="field.id">
                                    {{ field.section_key }} · {{ field.label_override || field.field_definition?.label }}
                                </li>
                            </ul>
                        </details>
                    </details>
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
