<template>
    <main class="content-template-form-view">
        <RouterLink :to="{ name: 'content-templates' }" class="content-template-back">
            ← Retour aux modèles
        </RouterLink>

        <header class="page-header">
            <h1>{{ isEditing ? 'Modifier le modèle' : 'Nouveau modèle' }}</h1>
            <p>
                {{ isEditing
                    ? 'Modifie les informations générales de ce modèle.'
                    : 'Définis une structure réutilisable pour tes fiches.' }}
            </p>
        </header>

        <p v-if="loading" class="content-templates-message">
            Chargement…
        </p>

        <form v-else class="content-template-form" @submit.prevent="submitForm">
            <div class="content-template-form__field">
                <label for="content-template-name">Nom du modèle</label>
                <input
                    id="content-template-name"
                    v-model="form.name"
                    required
                    maxlength="255"
                    placeholder="Ex. Fiche de personnage"
                    :disabled="saving"
                >
            </div>

            <div class="content-template-form__field">
                <label for="content-template-description">Description (facultatif)</label>
                <textarea
                    id="content-template-description"
                    v-model="form.description"
                    rows="3"
                    maxlength="5000"
                    placeholder="À quoi servira ce modèle ?"
                    :disabled="saving"
                ></textarea>
            </div>

            <div class="content-template-form__field">
                <label for="content-template-type">Type de fiche</label>
                <select
                    id="content-template-type"
                    v-model="form.content_type_id"
                    required
                    :disabled="saving"
                >
                    <option value="" disabled>Choisir un type</option>
                    <option
                        v-for="type in contentTypes"
                        :key="type.id"
                        :value="String(type.id)"
                    >
                        {{ type.name }}
                    </option>
                </select>
            </div>

            <div class="content-template-form__field">
                <label for="content-template-scope">Portée du modèle</label>
                <select
                    id="content-template-scope"
                    v-model="form.scope_type"
                    :disabled="saving"
                >
                    <option value="global">Global — disponible partout</option>
                    <option value="universe">Un univers précis</option>
                    <option value="project">Un projet précis</option>
                </select>
            </div>

            <div v-if="form.scope_type === 'universe'" class="content-template-form__field">
                <label for="content-template-universe">Univers</label>
                <select
                    id="content-template-universe"
                    v-model="form.universe_id"
                    required
                    :disabled="saving"
                >
                    <option value="" disabled>Choisir un univers</option>
                    <option v-for="universe in universes" :key="universe.id" :value="String(universe.id)">
                        {{ universe.name }}
                    </option>
                </select>
                <p v-if="!universes.length" class="content-template-form__hint">
                    Aucun univers n’a encore été créé.
                </p>
            </div>

            <div v-if="form.scope_type === 'project'" class="content-template-form__field">
                <label for="content-template-project">Projet</label>
                <select
                    id="content-template-project"
                    v-model="form.project_id"
                    required
                    :disabled="saving"
                >
                    <option value="" disabled>Choisir un projet</option>
                    <option v-for="project in projects" :key="project.id" :value="String(project.id)">
                        {{ project.name }}
                    </option>
                </select>
                <p v-if="!projects.length" class="content-template-form__hint">
                    Aucun projet n’a encore été créé.
                </p>
            </div>

            <p v-if="error" class="error" role="alert">{{ error }}</p>

            <div class="form-actions">
                <button
                    type="button"
                    class="button-secondary"
                    :disabled="saving"
                    @click="cancelForm"
                >
                    Annuler
                </button>
                <button type="submit" :disabled="saving || !contentTypes.length">
                    {{ saving ? 'Enregistrement…' : (isEditing ? 'Enregistrer' : 'Créer le modèle') }}
                </button>
            </div>
        </form>
    </main>
</template>

<script src="./ContentTemplateFormView.js"></script>
