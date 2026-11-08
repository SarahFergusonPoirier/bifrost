<template>
    <section>
        <h1>Idées du projet</h1>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="busy" role="status">Traitement…</p>
        <form v-if="!archive" @submit.prevent="capture">
            <fieldset :disabled="busy">
                <legend>Capture rapide</legend>
                <label>Titre facultatif <input v-model="title" maxlength="255" /></label>
                <label>Idée <textarea v-model="body" required maxlength="100000" /></label>
                <button type="submit">Capturer l’idée</button>
            </fieldset>
        </form>
        <label><input v-model="archive" type="checkbox" :disabled="busy" @change="load()" /> Archives</label>
        <label>Présentation <select v-model="view" :disabled="archive"><option value="kanban">Kanban</option><option value="list">Liste</option></select></label>
        <label>Rechercher sur cette page <input v-model="query" type="search" /></label>
        <section v-for="[label, ideas] in groups" :key="label">
            <h2>{{ label }}</h2>
            <p v-if="!ideas.length">Aucune idée.</p>
            <article v-for="idea in ideas" :key="idea.id">
                <h3>{{ idea.title || 'Idée sans titre' }}</h3>
                <p>{{ idea.body }}</p>
                <label v-if="!archive">Colonne
                    <select :value="idea.column_key" :disabled="busy" @change="change(idea.id, { column_key: $event.target.value })">
                        <option v-for="(name, key) in columns" :key="key" :value="key">{{ name }}</option>
                    </select>
                </label>
                <button type="button" :disabled="busy" @click="edit(idea)">Modifier</button>
                <button type="button" :disabled="busy" @click="change(idea.id, { archived: !archive })">{{ archive ? 'Restaurer' : 'Archiver' }}</button>
                <button v-if="types.length" type="button" :disabled="busy" @click="beginConversion(idea)">Convertir en fiche brouillon</button>
                <ul v-if="idea.conversions.length">
                    <li v-for="content in idea.conversions" :key="content.public_id">
                        <button type="button" @click="$emit('open-content', content.public_id)">{{ content.title }}</button>
                    </li>
                </ul>
                <form v-if="editing?.id === idea.id" @submit.prevent="saveEdit">
                    <fieldset :disabled="busy">
                        <legend>Modifier l’idée</legend>
                        <label>Titre <input v-model="editing.title" maxlength="255" /></label>
                        <label>Texte <textarea v-model="editing.body" required maxlength="100000" /></label>
                        <label>Collections <select v-model="editing.folder_ids" multiple>
                            <option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.label }}</option>
                        </select></label>
                        <button type="submit">Enregistrer</button>
                        <button type="button" @click="editing = null">Annuler</button>
                    </fieldset>
                </form>
                <form v-if="conversion?.id === idea.id" @submit.prevent="convert">
                    <fieldset :disabled="busy">
                        <legend>Créer une fiche à partir de l’idée</legend>
                        <label>Titre de la fiche <input v-model="conversion.title" required maxlength="255" /></label>
                        <label>Type de fiche <select v-model="conversion.content_type_id" required>
                            <option value="" disabled>Choisir un type</option>
                            <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
                        </select></label>
                        <button type="submit">Créer le brouillon</button>
                        <button type="button" @click="conversion = null">Annuler</button>
                    </fieldset>
                </form>
            </article>
        </section>
        <template v-if="page?.last_page > 1">
            <button type="button" :disabled="busy || page.current_page <= 1" @click="load(page.current_page - 1)">Précédent</button>
            <button type="button" :disabled="busy || page.current_page >= page.last_page" @click="load(page.current_page + 1)">Suivant</button>
        </template>
    </section>
</template>

<script src="./ProjectIdeas.js"></script>
