<template>
    <section class="project-overview">
        <ProjectToolbar :project="project" :busy="busy" @search="$emit('search', $event)" />

        <header class="overview-hero">
            <img v-if="images.banner" class="overview-banner" :src="images.banner" alt="" />
            <div class="overview-cover">
                <img v-if="images.cover || project?.cover_image" :src="images.cover || '/storage/' + project.cover_image" alt="Illustration du projet" />
                <WorkspaceIcon v-else name="project" />
            </div>
            <div class="overview-hero-content">
                <h1>{{ project?.name ?? 'Vue d’ensemble du projet' }}</h1>
                <p>{{ project?.description || 'Espace de création d’univers' }}</p>
                <div class="overview-actions">
                    <button type="button" :disabled="busy" @click="$emit('catalogue', 'catalogue-create-title')">＋ Créer une fiche</button>
                    <button type="button" :disabled="busy" @click="$emit('panel', 'ideas')">Noter une idée</button>
                    <button type="button" :disabled="busy" @click="$emit('catalogue', 'catalogue-folder-name')">Nouveau dossier</button>
                </div>
            </div>
        </header>
        <details class="overview-image-settings">
            <summary>Personnaliser les images</summary>
            <label>Image carrée <input type="file" accept="image/png,image/jpeg,image/webp" @change="chooseImage('cover', $event)" /></label>
            <button v-if="images.cover" type="button" @click="saveImage('cover', null)">Réinitialiser l’image carrée</button>
            <label>Image de fond <input type="file" accept="image/png,image/jpeg,image/webp" @change="chooseImage('banner', $event)" /></label>
            <button v-if="images.banner" type="button" @click="saveImage('banner', null)">Réinitialiser le fond</button>
            <p v-if="imageError" role="alert">{{ imageError }}</p>
        </details>
        <p v-if="error" role="alert">{{ error }}</p>

        <section class="overview-stats" aria-label="Aperçu de l’univers">
            <h2>Aperçu de l’univers</h2>
            <button v-for="category in categories" :key="category.key" type="button" :disabled="busy || !category.id"
                @click="$emit('category', category.id)">
                <strong>{{ category.count }}</strong><span>{{ category.label }}</span>
            </button>
            <div class="overview-stat-total"><strong>{{ categories.reduce((sum, category) => sum + category.count, 0) }}</strong><span>Fiches de base</span></div>
        </section>

        <nav class="overview-shortcuts" aria-label="Accès rapides du projet">
            <button type="button" :disabled="busy" @click="$emit('catalogue')"><WorkspaceIcon name="catalogue" /><strong>Catalogue ›</strong><span>Parcourir les fiches et leurs collections.</span></button>
            <button type="button" :disabled="busy" @click="$emit('panel', 'graphs')"><WorkspaceIcon name="connections" /><strong>Graphes ›</strong><span>Visualiser les relations entre les fiches.</span></button>
            <button type="button" :disabled="busy" @click="$emit('panel', 'connections')"><WorkspaceIcon name="folder" /><strong>Connexions ›</strong><span>Explorer les relations de chaque fiche.</span></button>
            <article><i class="workspace-icon fi-rr-sparkles" aria-hidden="true"></i><strong>Suggestions</strong><span>Module à venir.</span></article>
        </nav>

        <div class="overview-columns">
            <section>
                <h2>Activité récente</h2>
                <p v-if="busy">Chargement…</p>
                <p v-else-if="!recent.length">Aucune fiche dans ce projet.</p>
                <ul v-else>
                    <li v-for="item in recent" :key="item.public_id">
                        <button type="button" @click="$emit('content', item.public_id)">{{ item.title }}</button>
                        <time v-if="item.updated_at" :datetime="item.updated_at">{{ item.updated_at.slice(0, 10) }}</time>
                    </li>
                </ul>
            </section>
            <section>
                <h2>Collections principales</h2>
                <p v-if="!folders.length">Aucune collection.</p>
                <ul v-else><li v-for="folder in folders" :key="folder.id"><button type="button" @click="$emit('folder', folder)">{{ folder.name }}</button></li></ul>
            </section>
            <section>
                <h2>Suggestions en attente</h2>
                <p>Aucune suggestion pour l’instant.</p>
            </section>
        </div>
    </section>
</template>

<script src="./ProjectOverview.js"></script>
