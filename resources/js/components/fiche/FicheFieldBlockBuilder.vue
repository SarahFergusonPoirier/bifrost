<template>
    <fieldset :disabled="disabled" @input="$emit('pending', true)" @change="$emit('pending', true)">
        <legend>{{ groupMode ? 'Sous-champs de chaque entrée' : schema ? 'Modifier les champs du bloc' : 'Nouveau bloc libre' }}</legend>
        <p v-if="schema && !groupMode">Les valeurs des champs retirés seront conservées et resteront accessibles dans l’historique et les données conservées.</p>
        <label v-if="!groupMode">Titre du bloc libre <input v-model="title" maxlength="255" @keydown.enter.prevent /></label>
        <div v-for="(field, index) in fields" :key="field.id">
            <h3>Champ {{ index + 1 }}</h3>
            <label>Nom du champ <input v-model="field.label" maxlength="255" @keydown.enter.prevent /></label>
            <label>Type du champ
                <select v-model="field.type" :disabled="Boolean(field.existingId || field.existingKey)" @change="field.default_value = null"><option v-for="(label, type) in types" :key="type" :value="type">{{ label }}</option></select>
            </label>
            <p v-if="field.existingId">Pour utiliser un autre type, ajoute un nouveau champ. Les valeurs d’un champ retiré restent conservées.</p>
            <label>Aide facultative <textarea v-model="field.help" maxlength="10000" /></label>
            <label><input v-model="field.required" type="checkbox" /> Champ obligatoire</label>
            <label>Historique
                <select v-model="field.history_view"><option value="current">Valeur actuelle</option><option value="history">Valeurs datées</option></select>
            </label>
            <label v-if="['choice', 'multiple_choice', 'capabilities'].includes(field.type)">Options ou catégories, une par ligne
                <textarea v-model="field.choicesText" />
            </label>
            <label v-if="field.type === 'choice'">Couleur du badge
                <select v-model="field.badge_color"><option value="">Texte</option><option value="accent">Accent</option><option value="blue">Bleu</option><option value="green">Vert</option><option value="amber">Ambre</option><option value="red">Rouge</option></select>
            </label>
            <template v-if="field.type === 'scale'">
                <label v-if="(field.existingId || field.existingKey) && Number(field.levels) !== field.originalLevels"><input v-model="field.preserveScale" type="checkbox" /> Conserver les valeurs existantes après le changement de niveaux</label>
                <label>Nombre de niveaux, de 2 à 20 <input v-model="field.levels" inputmode="numeric" @keydown.enter.prevent /></label>
                <label>Affichage de l’échelle
                    <select v-model="field.scale_display"><option value="both">Segments et chiffre</option><option value="segments">Segments</option><option value="number">Chiffre</option></select>
                </label>
                <label>Description des niveaux, une par ligne <textarea v-model="field.levelDescriptions" /></label>
            </template>
            <label v-if="field.type === 'number'">Calcul
                <select v-model="field.calculation"><option value="none">Valeur saisie</option><option value="age">Âge depuis la date de naissance du bloc</option></select>
            </label>
            <label v-if="field.type === 'repeatable'">Niveaux de la liste
                <select v-model="field.repeatable_level_mode"><option value="text">Texte</option><option value="segments">Segments</option></select>
            </label>
            <details v-if="field.type === 'repeatable'">
                <summary>Configurer les sous-champs du groupe · {{ field.entry_fields.length }}</summary>
                <p>Retirer un sous-champ conserve ses valeurs dans les données conservées du groupe.</p>
                <FicheFieldBlockBuilder group-mode :depth="depth + 1" :schema="field.groupEditor"
                    :content-id="contentId" :targets="targets" :reference-types="referenceTypes" @pending="field.groupPending = $event" @update="setGroupFields(field, $event.fields)" />
                <p v-if="field.groupPending" role="status">Applique la structure du groupe avant de préparer ce bloc.</p>
            </details>
            <template v-if="['reference', 'references'].includes(field.type)">
                <label>Types de fiches autorisés
                    <select v-model="field.reference_types" :disabled="Boolean(field.existingId || field.existingKey)" multiple><option v-for="type in referenceTypes" :key="type.id" :value="type.id">{{ type.name }}</option></select>
                </label>
                <p>Aucune sélection autorise tous les types accessibles dans le projet.</p>
                <label><input v-model="field.allow_reference_creation" type="checkbox" /> Permettre de créer une fiche depuis ce champ</label>
            </template>
            <label><input v-model="field.default_enabled" type="checkbox" /> Définir une valeur par défaut</label>
            <FicheDefaultValueEditor v-if="field.default_enabled" v-model="field.default_value" :type="field.type" :content-id="contentId" :targets="targets"
                :reference-types="field.reference_types" :choices="field.choicesText.split('\n').map(value => value.trim()).filter(Boolean)"
                :levels="Number(field.levels) || 5" :level-mode="field.repeatable_level_mode" :entry-fields="previewEntryFields(field.entry_fields)" />
            <button type="button" :disabled="index === 0" :aria-label="'Monter le champ ' + field.label" @click="move(index, -1)">Monter</button>
            <button type="button" :disabled="index === fields.length - 1" :aria-label="'Descendre le champ ' + field.label" @click="move(index, 1)">Descendre</button>
            <button type="button" :aria-label="'Retirer le champ ' + field.label" @click="removeField(index)">Retirer le champ</button>
        </div>
        <fieldset v-if="!groupMode && scaleFields.length" @input="scalePending = true" @change="scalePending = true">
            <legend>Échelles du bloc</legend>
            <p>Appliquer un réglage commun aux {{ scaleFields.length }} échelle(s) de ce bloc.</p>
            <label>Nombre commun de niveaux, de 2 à 20 <input v-model="blockScaleLevels" inputmode="numeric" @keydown.enter.prevent /></label>
            <label>Affichage commun
                <select v-model="blockScaleDisplay"><option value="both">Segments et chiffre</option><option value="segments">Segments</option><option value="number">Chiffre</option></select>
            </label>
            <ul v-if="scaleChanges.length"><li v-for="field in scaleChanges" :key="field.id">{{ field.label }} : {{ field.originalLevels }} → {{ blockScaleLevels }} niveaux.</li></ul>
            <label v-if="scaleChanges.length"><input v-model="preserveBlockScale" type="checkbox" /> Conserver les valeurs existantes lors de ce changement commun</label>
            <p v-if="scaleChanges.length">Les valeurs actuelles restent enregistrées. Celles qui dépassent le nouveau maximum sont signalées comme valeurs conservées.</p>
            <button type="button" :disabled="!canApplyBlockScale" @click="applyBlockScale">Appliquer aux échelles du bloc</button>
            <button v-if="scalePending" type="button" @click="resetBlockScale">Annuler le réglage commun</button>
            <p v-if="scalePending" role="status">Applique ou annule ce réglage commun avant de préparer le bloc.</p>
        </fieldset>
        <button type="button" :disabled="fields.length >= limit" @click="addField">Ajouter un champ</button>
        <button type="button" :disabled="!valid" @click="create">{{ groupMode ? 'Appliquer la structure du groupe' : schema ? 'Préparer les changements des champs' : 'Ajouter le bloc libre à la disposition' }}</button>
        <button v-if="title || fields.length" type="button" @click="reset">Effacer le bloc en préparation</button>
    </fieldset>
</template>

<script src="./FicheFieldBlockBuilder.js"></script>
