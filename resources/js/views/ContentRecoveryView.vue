<template>
    <component :is="projectId ? 'AppLayout' : 'div'" :class="{ 'project-workspace': projectId }" :workspace="Boolean(projectId)">
        <template #sidebar>
            <header class="workspace-brand">
                <span class="workspace-brand__mark" aria-hidden="true">
                    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
                        <path d="M3 26Q20 1 37 26M8 26Q20 9 32 26" stroke="white" stroke-width="2.8" />
                    </svg>
                </span>
                <strong>Bifrost</strong>
            </header>
            <details class="workspace-project">
                <summary><WorkspaceIcon name="project" /><span>{{ currentProject?.name ?? 'Projet' }}</span></summary>
                <p class="workspace-project__version" aria-current="true">{{ currentProject?.name ?? 'Projet' }}</p>
            </details>
            <nav class="workspace-nav" aria-label="Navigation du projet">
                <p class="workspace-nav__heading">Espace projet</p>
                <button type="button" class="workspace-link" :aria-current="panel === 'overview' ? 'page' : undefined"
                    :disabled="busy || saving" @click="openPanel('overview')"><WorkspaceIcon name="overview" />Vue d’ensemble</button>
                <button type="button" class="workspace-link" :aria-current="panel === 'catalogue' && !trash ? 'page' : undefined"
                    :disabled="busy || saving" @click="openTreeItem({})"><WorkspaceIcon name="catalogue" />Catalogue</button>
                <button type="button" class="workspace-link" :aria-current="panel === 'graphs' ? 'page' : undefined"
                    :disabled="busy || saving" @click="openPanel('graphs')"><WorkspaceIcon name="connections" />Graphes</button>
                <button v-if="panel === 'graphs' || panel === 'connections'" type="button" class="workspace-link workspace-link--child"
                    :aria-current="panel === 'connections' ? 'page' : undefined"
                    :disabled="busy || saving" @click="openPanel('connections')">↳ Connexions</button>
                <template v-for="[key, label] in [['timeline', 'Chronologies'], ['maps', 'Cartes'], ['narration', 'Narration'], ['ideas', 'Idées'], ['search', 'Recherche']]" :key="key">
                    <button type="button" class="workspace-link" :aria-current="panel === key ? 'page' : undefined"
                        :disabled="busy || saving || key === 'maps' || key === 'search'"
                        :title="key === 'maps' || key === 'search' ? 'Module à venir' : undefined"
                        @click="openPanel(key)"><WorkspaceIcon :name="key" />{{ label }}</button>
                </template>
                <hr />
                <RouterLink :to="{ name: 'home' }" class="workspace-link">← Quitter le projet</RouterLink>
                <button type="button" class="workspace-link" :aria-current="panel === 'settings' ? 'page' : undefined"
                    :disabled="busy || saving" @click="openPanel('settings')"><WorkspaceIcon name="settings" />Paramètres du projet</button>
                <button type="button" class="workspace-link workspace-link--child" :aria-current="trash ? 'page' : undefined"
                    :disabled="busy || saving" @click="openProjectTrash">Corbeille des fiches</button>
            </nav>
        </template>
        <ProjectDetailsView v-if="panel === 'settings'" />
        <ProjectNarrative v-else-if="panel === 'narration'" :project-id="projectId" @open-content="openPanelContent" />
        <ProjectIdeas v-else-if="panel === 'ideas'" :project-id="projectId" :folders="folderOptions" :types="types" @open-content="openPanelContent" />
        <ProjectConnections v-else-if="panel === 'graphs' || panel === 'connections'" :mode="panel" :project-id="projectId" @open-content="openPanelContent" />
        <ProjectTimeline v-else-if="panel === 'timeline'" :project-id="projectId" @open-content="openPanelContent" />
        <section v-else-if="panel === 'overview'" class="content-templates-view">
            <header class="page-header">
                <h1>{{ currentProject?.name ?? 'Vue d’ensemble du projet' }}</h1>
                <p v-if="currentProject?.description">{{ currentProject.description }}</p>
                <img v-if="currentProject?.cover_image" :src="'/storage/' + currentProject.cover_image"
                    :alt="'Couverture de ' + currentProject.name" width="300" />
            </header>
            <p v-if="error" role="alert">{{ error }}</p>
            <nav aria-label="Accès rapides du projet">
                <button type="button" :disabled="busy" @click="openTreeItem({})">Catalogue et création de fiche</button>
                <button type="button" :disabled="busy" @click="openPanel('ideas')">Capturer une idée</button>
                <button type="button" :disabled="busy" @click="openPanel('graphs')">Graphes et connexions</button>
                <button type="button" :disabled="busy" @click="openPanel('timeline')">Chronologie</button>
                <button type="button" :disabled="busy" @click="openPanel('narration')">Narration</button>
            </nav>
            <h2>Fiches récemment modifiées</h2>
            <p v-if="busy">Chargement…</p>
            <p v-else-if="!recentContents.length">Aucune fiche dans ce projet.</p>
            <ul v-else>
                <li v-for="item in recentContents" :key="item.public_id">
                    <button type="button" @click="openPanelContent(item.public_id)">{{ item.title }}</button>
                    <time v-if="item.updated_at" :datetime="item.updated_at"> · {{ item.updated_at.slice(0, 10) }}</time>
                </li>
            </ul>
        </section>
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
                <nav class="catalogue-tree" aria-label="Dossiers et fiches du catalogue">
                    <button v-for="item in sidebarItems" :key="item.key" class="catalogue-tree__item"
                        type="button" :style="{ paddingInlineStart: (item.depth + 2.5) + 'rem' }"
                        :disabled="busy || saving" :draggable="Boolean(item.content) && !busy && !saving"
                        @dragstart="item.content && beginDrag($event, item)"
                        @dragover="item.folder && $event.preventDefault()"
                        @drop.prevent="item.folder && dropInto($event, item)"
                        @click="openTreeItem(item)">
                        {{ item.folder ? '▸ ' + item.folder.name : item.content.title }}
                    </button>
                </nav>
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

            <form v-if="projectId && !trash" @submit.prevent="searchCatalogue">
                <fieldset>
                    <legend>Rechercher dans le catalogue</legend>
                    <label>Texte <input v-model="catalogueSearch" type="search" maxlength="255" /></label>
                    <label>Type <select v-model="catalogueType">
                        <option value="">Tous</option>
                        <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
                    </select></label>
                    <label>Statut <select v-model="catalogueStatus">
                        <option value="">Tous</option><option value="draft">Brouillon</option>
                        <option value="in_progress">En cours</option><option value="completed">Terminé</option>
                        <option value="abandoned">Abandonné</option>
                    </select></label>
                    <label>Étiquette <select v-model="catalogueTag">
                        <option value="">Toutes</option>
                        <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
                    </select></label>
                    <label><input v-model="searchWholeProject" type="checkbox" /> Chercher dans tout le projet</label>
                    <button type="submit">Appliquer les filtres</button>
                </fieldset>
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
            <ContentAttachments :key="selected.public_id" :content-id="selected.public_id" />
            <p v-if="selected.origin_idea">
                Issue de l’idée {{ selected.origin_idea.title || 'sans titre' }}.
                <button type="button" :disabled="busy || saving" @click="openPanel('ideas')">Ouvrir les idées du projet</button>
            </p>
            <p v-if="selected.template_assignment">
                Modèle · Version {{ selected.template_assignment.template_version.version_number }}
            </p>
            <details v-if="selected.template_assignment">
                <summary>Changer de version du modèle</summary>
                <button type="button" :disabled="busy || saving || dirty" @click="loadUpgradeVersions">Rechercher les versions publiées</button>
                <form v-if="upgradeVersions.length" @submit.prevent="previewUpgrade">
                    <label>Version cible <select v-model="upgradeVersionId" required @change="upgradePreview = null">
                        <option value="" disabled>Choisir une version</option>
                        <option v-for="version in upgradeVersions" :key="version.id" :value="version.id">Version {{ version.version_number }}</option>
                    </select></label>
                    <button type="submit" :disabled="busy || saving || dirty">Prévisualiser</button>
                </form>
                <template v-if="upgradePreview">
                    <p>Les valeurs des champs retirés seront conservées.</p>
                    <section v-for="[key, label] in [['added', 'Champs ajoutés'], ['removed', 'Champs retirés'], ['changed', 'Champs modifiés']]" :key="key">
                        <h3>{{ label }}</h3>
                        <ul v-if="upgradePreview[key].length">
                            <li v-for="field in upgradePreview[key]" :key="field.id">{{ field.label || 'Champ ' + field.id }}</li>
                        </ul>
                        <p v-else>Aucun</p>
                    </section>
                    <button type="button" :disabled="busy || saving || dirty" @click="applyUpgrade">Appliquer cette version</button>
                </template>
            </details>
            <p role="status">{{ saving ? 'Enregistrement…' : dirty ? 'Modifications non enregistrées' : 'Toutes les modifications sont enregistrées.' }}</p>
            <div aria-label="Présentation de la fiche">
                <button type="button" :aria-pressed="compact" @click="setCompact(true)">Vue compacte</button>
                <button type="button" :aria-pressed="!compact" @click="setCompact(false)">Vue complète</button>
            </div>
            <section v-if="compact" aria-label="Lecture compacte">
                <p v-if="draft.summary">{{ draft.summary }}</p>
                <p v-if="selected.tags?.length">{{ selected.tags.map(tag => tag.name).join(' · ') }}</p>
                <label v-if="templateSections.size"><input v-model="showHidden" type="checkbox" /> Afficher les champs masqués</label>
                <details v-for="[section, fields] in templateSections" :key="section" open>
                    <summary>{{ section }}</summary>
                    <dl>
                        <template v-for="field in fields.filter(item => showHidden || !hiddenFields.includes(item.field_definition_id))" :key="field.id">
                            <dt>{{ field.label_override || field.field_definition.label }}</dt>
                            <dd>{{ displayValue(field) }}
                                <button type="button" @click="toggleHidden(field.field_definition_id)">
                                    {{ hiddenFields.includes(field.field_definition_id) ? 'Réafficher' : 'Masquer' }}
                                </button>
                            </dd>
                        </template>
                    </dl>
                </details>
                <article v-for="(block, index) in draft.blocks" :key="block.public_id ?? index">
                    <h3 v-if="block.title">{{ block.title }}</h3>
                    <p v-if="block.body" style="white-space: pre-wrap">{{ block.body }}</p>
                </article>
            </section>
            <form v-else @submit.prevent="save">
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
                    <fieldset v-if="draft.tag_ids">
                        <legend>Étiquettes</legend>
                        <label>Étiquettes associées
                            <select v-model="draft.tag_ids" multiple>
                                <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
                            </select>
                        </label>
                        <label>Nouvelle étiquette <input v-model="newTag" maxlength="255" @keydown.enter.prevent="addTag" /></label>
                        <button type="button" :disabled="!newTag.trim()" @click="addTag">Créer et associer</button>
                    </fieldset>
                    <details v-for="[section, fields] in templateSections" :key="section" open>
                        <summary>{{ section }}</summary>
                        <div v-for="field in fields" :key="field.id">
                            <label v-if="field.format === 'multiple_choice'">
                                {{ field.label_override || field.field_definition.label }}
                                <select multiple @change="setMultipleChoice(field, $event)">
                                    <option v-for="option in choiceOptions(field)" :key="option" :value="option"
                                        :selected="(fieldValue(field) || []).includes(option)">{{ option }}</option>
                                </select>
                            </label>
                            <fieldset v-else-if="field.column === 'value_json'">
                                <legend>{{ field.label_override || field.field_definition.label }}</legend>
                                <StructuredField :format="field.format" :value="fieldValue(field) || null"
                                    :targets="referenceTargets" @change="setField(field, $event)" />
                            </fieldset>
                            <label v-else>
                                {{ field.label_override || field.field_definition.label }}
                                <select v-if="field.column === 'reference_content_id'" :value="fieldValue(field)" @change="setField(field, $event.target.value)">
                                    <option value="">Aucune fiche</option>
                                    <option v-if="fieldValue(field) && !allowedTargets(field).some(item => item.id === Number(fieldValue(field)))"
                                        :value="fieldValue(field)">Fiche indisponible</option>
                                    <option v-for="target in allowedTargets(field)" :key="target.id" :value="target.id">{{ target.title }}</option>
                                </select>
                                <select v-else-if="field.field_definition.value_type === 'choice' && (field.display_options?.choices ?? field.field_definition.options_data?.choices)?.length"
                                    :value="fieldValue(field)" @change="setField(field, $event.target.value)">
                                    <option value="">Vide</option>
                                    <option v-for="option in choiceOptions(field)" :key="option" :value="option">{{ option }}</option>
                                </select>
                                <select v-else-if="field.column === 'value_boolean'" :value="String(fieldValue(field))" @change="setField(field, $event.target.value)">
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
