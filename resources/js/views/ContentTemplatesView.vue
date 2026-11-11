<template>
    <main class="content-templates-view">
        <header class="page-header">
            <h1>Modèles</h1>
            <p>Des structures réutilisables pour organiser tes contenus.</p>
        </header>

        <p v-if="editorError" role="alert">{{ editorError }}</p>
        <button v-if="!editor && !typeEditor" type="button" :disabled="saving" @click="editTemplate()">Créer un modèle</button>
        <button v-if="!editor && !typeEditor" type="button" :disabled="saving" @click="startType">Créer un type de fiche</button>
        <form v-if="typeEditor" @submit.prevent="saveType">
            <fieldset :disabled="saving">
                <legend>Nouveau type de fiche</legend>
                <label>Nom <input v-model="typeEditor.name" required maxlength="255" /></label>
                <label>Description <textarea v-model="typeEditor.description" maxlength="10000" /></label>
                <label>Portée <select v-model="typeEditor.project_id">
                    <option value="">Globale</option>
                    <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
                </select></label>
                <button type="submit">Créer le type</button>
                <button type="button" @click="typeEditor = null">Annuler</button>
            </fieldset>
        </form>
        <form v-if="editor" @submit.prevent="saveTemplate">
            <fieldset :disabled="saving">
                <legend>{{ editor.id ? 'Publier une nouvelle version' : 'Créer un modèle' }}</legend>
                <template v-if="!editor.id">
                    <label>Nom <input v-model="editor.name" required maxlength="255" /></label>
                    <label>Description <textarea v-model="editor.description" maxlength="10000" /></label>
                    <label>Type de fiche <select v-model="editor.content_type_id" required :disabled="Boolean(editor.base_version_id)">
                        <option value="" disabled>Choisir un type</option>
                        <option v-for="type in availableTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
                    </select></label>
                    <label>Portée <select v-model="editor.project_id">
                        <option value="">Bibliothèque globale</option>
                        <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
                    </select></label>
                </template>
                <fieldset v-for="(field, index) in editor.fields" :key="index">
                    <legend>Champ {{ index + 1 }}</legend>
                    <label>Libellé <input v-model="field.label" required maxlength="255" /></label>
                    <label>Section <input v-model="field.section" required maxlength="255" /></label>
                    <label>Type <select v-model="field.type" :disabled="Boolean(field.id)">
                        <option v-if="!fieldTypes[field.type]" :value="field.type">{{ field.type }}</option>
                        <option v-for="(label, key) in fieldTypes" :key="key" :value="key">{{ label }}</option>
                    </select></label>
                    <label v-if="field.type === 'number'">Calcul automatique
                        <select :value="field.calculation ?? 'none'" @change="field.calculation = $event.target.value">
                            <option value="none">Aucun</option>
                            <option value="age">Âge à partir de la date de naissance</option>
                        </select>
                        <small v-if="field.calculation === 'age'">
                            Ajoutez un champ de date nommé « Date de naissance ». Le calcul utilise une date grégorienne exacte.
                            Une valeur saisie dans la fiche est prioritaire.
                        </small>
                    </label>
                    <label v-if="field.type === 'scale'">Nombre de niveaux
                        <input type="number" min="2" max="20" required :value="field.levels ?? 5"
                            @input="field.levels = $event.target.valueAsNumber" />
                    </label>
                    <label v-if="!field.id && ['reference', 'references'].includes(field.type)">Types de fiches autorisés (aucune sélection = tous)
                        <select v-model="field.referenceTypes" multiple>
                            <option v-for="type in availableTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
                        </select>
                    </label>
                    <label v-if="['reference', 'references'].includes(field.type)">
                        <input v-model="field.allowReferenceCreation" type="checkbox" /> Autoriser la création depuis la fiche
                    </label>
                    <label>Historique du champ
                        <select v-model="field.historyView">
                            <option value="current">Valeur actuelle</option>
                            <option value="history">Valeur actuelle et historique</option>
                        </select>
                    </label>
                    <label v-if="field.type === 'repeatable'">Présentation du niveau
                        <select v-model="field.repeatableLevelMode">
                            <option value="text">Texte libre</option>
                            <option value="segments">Échelle segmentée</option>
                        </select>
                    </label>
                    <template v-if="field.type === 'scale'">
                        <label v-if="field.id && field.levels !== field.originalLevels">
                            <input type="checkbox" v-model="field.preserveScale" required />
                            Conserver les valeurs existantes, y compris celles au-dessus du nouveau maximum.
                        </label>
                        <label>Descriptions des niveaux (une ligne par niveau)
                            <textarea v-model="field.levelDescriptions" maxlength="5120" />
                        </label>
                        <label>Affichage de l’échelle
                            <select v-model="field.scaleDisplay">
                                <option value="both">Segments et chiffres</option>
                                <option value="segments">Segments</option>
                                <option value="number">Chiffres</option>
                            </select>
                        </label>
                    </template>
                    <label v-if="field.type === 'choice'">Affichage du choix
                        <select v-model="field.badgeColor">
                            <option value="">Texte</option>
                            <option value="accent">Badge violet</option>
                            <option value="blue">Badge bleu</option>
                            <option value="green">Badge vert</option>
                            <option value="amber">Badge ambre</option>
                            <option value="red">Badge rouge</option>
                        </select>
                    </label>
                    <label v-if="['choice', 'multiple_choice', 'capabilities'].includes(field.type)">
                        {{ field.type === 'capabilities' ? 'Catégories (une par ligne)' : 'Options (une par ligne)' }} <textarea v-model="field.choicesText" maxlength="10000" />
                    </label>
                    <label>Aide <textarea v-model="field.help" maxlength="10000" /></label>
                    <label><input v-model="field.required" type="checkbox" /> Obligatoire</label>
                    <button type="button" :disabled="index === 0" @click="moveField(index, -1)">Monter</button>
                    <button type="button" :disabled="index === editor.fields.length - 1" @click="moveField(index, 1)">Descendre</button>
                    <button type="button" @click="editor.fields.splice(index, 1)">Retirer le champ</button>
                </fieldset>
                <button type="button" :disabled="editor.fields.length >= 200"
                    @click="editor.fields.push({ label: '', section: 'Informations', type: 'text', help: '', required: false })">Ajouter un champ</button>
                <details>
                    <summary>Bibliothèque des champs d’identité</summary>
                    <label>Genre
                        <select v-model="identityGroup">
                            <option v-for="(_, group) in identityGroups" :key="group" :value="group">{{ group }}</option>
                        </select>
                    </label>
                    <label>Rechercher <input v-model="identityQuery" type="search" /></label>
                    <ul>
                        <li v-for="label in identitySuggestions" :key="label">
                            <button type="button" @click="addIdentityField(label)">{{ label }}</button>
                        </li>
                    </ul>
                </details>
                <button type="submit">Publier</button>
                <button type="button" @click="editor = null">Annuler</button>
            </fieldset>
        </form>

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
                    <div>
                        <button type="button" :disabled="saving" @click="editTemplate(template, true)">Dupliquer</button>
                        <button v-if="!template.is_system" type="button" :disabled="saving" @click="editTemplate(template)">Nouvelle version</button>
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
