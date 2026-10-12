<template>
    <main class="project-create-view">
        <RouterLink :to="{ name: 'projects' }">
            ← Retour aux projets
        </RouterLink>

        <header class="page-header">
            <h1>Nouveau projet</h1>
            <p>Crée un projet pour organiser tes idées.</p>
        </header>

        <section class="project-create-section">
            <ProjectForm
                :saving="saving"
                :error="saveError"
                @submit="handleCreate"
                @cancel="cancelCreate"
            />
        </section>
    </main>
</template>

<script src="./ProjectCreateView.js"></script>