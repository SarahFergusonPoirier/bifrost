<template>
    <component :is="projectId ? 'AppLayout' : 'div'">
        <template #sidebar>
            <RouterLink :to="{ name: 'home' }" class="app-navigation__link">← Quitter le projet</RouterLink>
            <nav class="app-navigation" aria-label="Arborescence du projet">
                <strong>{{ currentProject?.name ?? 'Projet' }}</strong>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openTreeItem({})">Racine du projet</button>
                <button v-for="item in sidebarItems" :key="item.key" class="app-navigation__link"
                    type="button" :style="{ paddingInlineStart: (item.depth + 1) + 'rem' }"
                    :disabled="busy || saving" :draggable="Boolean(item.content) && !busy && !saving"
                    @dragstart="item.content && beginDrag($event, item)"
                    @dragover="item.folder && $event.preventDefault()"
                    @drop.prevent="item.folder && dropInto($event, item)"
                    @click="openTreeItem(item)">
                    {{ item.folder ? '▸ ' + item.folder.name : item.content.title }}
                </button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openProjectTrash">Corbeille des fiches</button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openConnections">Graphes et connexions</button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openNarration">Narration</button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openIdeas">Idées</button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openTimeline">Chronologie</button>
                <button class="app-navigation__link" type="button" :disabled="busy || saving" @click="openSettings">Paramètres du projet</button>
            </nav>
        </template>
        <ProjectDetailsView v-if="settings" />
        <ProjectNarrative v-else-if="narration" :project-id="projectId" @open-content="openTimelineContent" />
        <ProjectIdeas v-else-if="ideas" :project-id="projectId" :folders="folderOptions" :types="types" @open-content="openTimelineContent" />
        <ProjectConnections v-else-if="connections" :project-id="projectId" @open-content="openTimelineContent" />
        <ProjectTimeline v-else-if="timeline" :project-id="projectId" @open-content="openTimelineContent" />
    <section v-else class="content-templates-view">
        <header class="page-header">
            <h1>{{ projectId ? 'Fiches du projet' : 'Corbeille des projets' }}</h1>
            <p v-if="currentProject">{{ currentProject.name }}</p>
            <p>{{ projectId ? 'Organise et ouvre les fiches de ce projet.' : 'Restaure un projet et ses contenus.' }}</p>
        </header>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <fieldset v-if="!selected" :disabled="busy">
            <legend>Contenus</legend>

            <section v-if="projectId && !trash" aria-labelledby="folder-heading">
                <h2 id="folder-heading">Dossiers du projet</h2>
                <template v-if="folderId">
                    <button type="button" @click="editFolder">Renommer ou déplacer ce dossier</button>
                    <button type="button" @click="deleteFolder">Supprimer ce dossier</button>
                </template>
                <form @submit.prevent="saveFolder">
                    <label>Nom du dossier <input v-model="folderName" required maxlength="255" /></label>
                    <label>Dossier parent
                        <select v-model="folderParent">
                            <option :value="0">Racine du projet</option>
                            <option v-for="folder in folderOptions" :key="folder.id" :value="folder.id" :disabled="folderEditing && folder.id === folderId">{{ folder.label }}</option>
                        </select>
                    </label>
                    <button type="submit">{{ folderEditing ? 'Enregistrer le dossier' : 'Créer un dossier' }}</button>
                    <button v-if="folderEditing" type="button" @click="cancelFolderEdit">Annuler</button>
                </form>
            </section>

            <form v-if="!trash" @submit.prevent="create">
                <label>Titre <input v-model="newTitle" required maxlength="255" /></label>
                <label>
                    Type de fiche
                    <select v-model="typeId" required>
                        <option value="" disabled>Choisir un type</option>
                        <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
                    </select>
                </label>
                <label>
                    Projet
                    <select v-model="selectedProjectId" :disabled="Boolean(projectId)" required>
                        <option value="" disabled>Choisir un projet</option>
                        <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
                    </select>
                </label>
                <label v-if="templateOptions.length">
                    Modèle
                    <select v-model="templateId">
                        <option value="">Sans modèle</option>
                        <option v-for="template in templateOptions" :key="template.id" :value="template.id">{{ template.name }}</option>
                    </select>
                </label>
                <label v-if="versions.length">
                    Version du modèle
                    <select v-model="versionId">
                        <option v-for="version in versions" :key="version.id" :value="version.id">Version {{ version.version_number }}</option>
                    </select>
                </label>
                <button type="submit" :disabled="!projects.length || (templateId && !versionId)">Créer une fiche</button>
            </form>

            <p v-if="!listing" role="status">Chargement des contenus…</p>
            <template v-else>
                <p v-if="!listing.data.length">{{ trash ? 'La corbeille est vide.' : 'Aucune fiche active.' }}</p>
                <ul v-else>
                    <li v-for="item in listing.data" :key="item.public_id ?? item.id">
                        <template v-if="trash">
                            {{ item.title ?? item.name }}
                            <button type="button" @click="recover(item.public_id ?? item.id)">Restaurer</button>
                        </template>
                        <button v-else type="button" @click="openContent(item.public_id)">{{ item.title ?? item.name }}</button>
                    </li>
                </ul>
                <button type="button" :disabled="listing.current_page <= 1" @click="browse(listing.current_page - 1)">Précédent</button>
                <span> Page {{ listing.current_page }} sur {{ listing.last_page }} </span>
                <button type="button" :disabled="listing.current_page >= listing.last_page" @click="browse(listing.current_page + 1)">Suivant</button>
            </template>
        </fieldset>

        <template v-else>
            <button type="button" :disabled="busy || saving" @click="close">Retour aux fiches</button>
            <h2>{{ selected.title }}</h2>
            <p v-if="selected.origin_idea">
                Issue de l’idée {{ selected.origin_idea.title || 'sans titre' }}.
                <button type="button" :disabled="busy || saving" @click="openIdeas">Ouvrir les idées du projet</button>
            </p>
            <p v-if="selected.template_assignment">
                Modèle · Version {{ selected.template_assignment.template_version.version_number }}
            </p>
            <p role="status">{{ saving ? 'Enregistrement…' : dirty ? 'Modifications non enregistrées' : 'Toutes les modifications sont enregistrées.' }}</p>
            <form @submit.prevent="save">
                <fieldset :disabled="busy || saving">
                    <legend>Modifier la fiche</legend>
                    <p><label>Titre <input v-model="draft.title" required maxlength="255" /></label></p>
                    <p v-if="draft.work_status_key"><label>Statut de travail
                        <select v-model="draft.work_status_key">
                            <option value="draft">Brouillon</option><option value="in_progress">En cours</option>
                            <option value="completed">Terminé</option><option value="abandoned">Abandonné</option>
                        </select>
                    </label></p>
                    <p><label>Résumé <textarea v-model="draft.summary" /></label></p>
                    <details v-for="[section, fields] in templateSections" :key="section" open>
                        <summary>{{ section }}</summary>
                        <div v-for="field in fields" :key="field.id">
                            <fieldset v-if="field.column === 'value_json'">
                                <legend>{{ field.label_override || field.field_definition.label }}</legend>
                                <StructuredField :format="field.format" :value="fieldValue(field) || null"
                                    :targets="referenceTargets" @change="setField(field, $event)" />
                            </fieldset>
                            <label v-else>
                                {{ field.label_override || field.field_definition.label }}
                                <select v-if="field.column === 'value_boolean'" :value="String(fieldValue(field))" @change="setField(field, $event.target.value)">
                                    <option value="">Vide</option>
                                    <option value="true">Oui</option>
                                    <option value="false">Non</option>
                                </select>
                                <input v-else :type="field.column === 'value_number' ? 'number' : field.column === 'value_date' ? 'date' : 'text'"
                                    :step="field.column === 'value_number' ? 'any' : undefined"
                                    :value="fieldValue(field)" @input="setField(field, $event.target.value)" />
                            </label>
                            <small v-if="field.help_text">{{ field.help_text }}</small>
                        </div>
                    </details>
                    <fieldset v-for="(block, index) in draft.blocks" :key="block.public_id ?? index">
                        <legend>Bloc {{ index + 1 }}</legend>
                        <p><label>Titre du bloc <input v-model="block.title" maxlength="255" /></label></p>
                        <p><label>Texte <textarea v-model="block.body" /></label></p>
                        <button type="button" @click="draft.blocks.splice(index, 1)">Retirer le bloc</button>
                    </fieldset>
                    <button type="button" @click="draft.blocks.push({ block_type: 'text', title: null, body: null })">Ajouter un bloc</button>
                    <button type="submit" :disabled="!dirty">Enregistrer</button>
                </fieldset>
            </form>

            <button type="button" :disabled="busy || saving || dirty" @click="deleteContent">Mettre à la corbeille</button>

            <section v-if="projectId" aria-label="Collections de la fiche">
                <h3>Collections de la fiche</h3>
                <ul>
                    <li v-for="folder in folderOptions.filter(item => memberships.includes(item.id))" :key="folder.id">
                        {{ folder.label }}
                        <button type="button" :disabled="busy || saving || dirty" @click="removeMembership(folder.id)">Retirer</button>
                    </li>
                </ul>
                <form @submit.prevent="addMembership">
                    <label>Ajouter à une collection
                        <select v-model="placement" :disabled="busy || saving" required>
                            <option :value="0" disabled>Choisir une collection</option>
                            <option v-for="folder in folderOptions.filter(item => !memberships.includes(item.id))" :key="folder.id" :value="folder.id">{{ folder.label }}</option>
                        </select>
                    </label>
                    <button type="submit" :disabled="!placement || busy || saving || dirty">Ajouter</button>
                </form>
            </section>

            <section aria-labelledby="revision-heading">
                <h2 id="revision-heading">Historique</h2>
                <form @submit.prevent="takeSnapshot">
                    <fieldset :disabled="busy || saving || dirty">
                        <legend>Créer un instantané</legend>
                        <label>Nom <input v-model="snapshotName" required maxlength="255" /></label>
                        <label>Note <textarea v-model="snapshotNote" maxlength="10000" /></label>
                        <button type="submit">Créer l’instantané</button>
                    </fieldset>
                </form>

                <p v-if="revisions && !revisions.data.length">Aucune révision enregistrée.</p>
                <template v-if="revisions?.data.length">
                    <ul>
                        <li v-for="revision in revisions.data" :key="revision.id">
                            <strong>{{ revision.label ?? 'Révision ' + revision.id }}</strong>
                            <time :datetime="revision.created_at">{{ revision.created_at }}</time>
                            <p v-if="revision.note">{{ revision.note }}</p>
                            <button type="button" :disabled="busy || saving" @click="from = revision.id">Comparer depuis</button>
                            <button type="button" :disabled="busy || saving" @click="to = revision.id">Comparer avec</button>
                            <button type="button" :disabled="busy || saving || dirty" @click="restore(revision.id)">Restaurer cette version</button>
                        </li>
                    </ul>
                    <button type="button" :disabled="busy || saving || revisions.current_page <= 1" @click="browseHistory(revisions.current_page - 1)">Révisions précédentes</button>
                    <button type="button" :disabled="busy || saving || revisions.current_page >= revisions.last_page" @click="browseHistory(revisions.current_page + 1)">Révisions suivantes</button>
                    <p>Versions sélectionnées {{ from || '—' }} et {{ to || '—' }}</p>
                    <button type="button" :disabled="busy || saving || !from || !to || from === to" @click="compare">Comparer les versions</button>
                </template>
                <div v-if="comparison" aria-live="polite">
                    <p v-if="!Object.keys(comparison).length">Aucune différence dans les données comparables.</p>
                    <details v-for="(change, key) in comparison" :key="key" open>
                        <summary>{{ ({ title: 'Titre', summary: 'Résumé', blocks: 'Blocs', field_values: 'Champs personnalisés' })[key] }}</summary>
                        <strong>Avant</strong>
                        <pre>{{ change.before }}</pre>
                        <strong>Après</strong>
                        <pre>{{ change.after }}</pre>
                    </details>
                </div>
            </section>
        </template>
    </section>
    </component>
</template>

<script src="./ContentRecoveryView.js"></script>
