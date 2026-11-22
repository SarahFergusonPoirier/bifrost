<template>
    <fieldset>
        <legend>{{ label }}</legend>
        <label>État
            <select :value="state" @change="updateState($event.target.value)"><option value="">Valeur renseignée</option><option value="unknown">Inconnu</option><option value="not_applicable">Non applicable</option></select>
        </label>
        <template v-if="!state">
            <FicheTextEditor v-if="type === 'rich_text'" label="Texte" :model-value="value" :targets="targets" @update:model-value="update" />
            <StructuredField v-else-if="structured" :format="type" :value="value || null" :content-id="contentId"
                :project-id="projectId" :content-types="contentTypes" @reference-created="$emit('reference-created', $event)"
                :targets="allowedTargets" :entry-fields="entryFields" :entry-label="entryLabel" :levels="levels" :category-options="choices" :level-mode="levelMode" @change="update" />
            <label v-else-if="type === 'multiple_choice'">Choix
                <select multiple @change="updateMultiple"><option v-for="choice in choices" :key="choice" :value="choice" :selected="value.includes(choice)">{{ choice }}</option><option v-for="choice in retainedChoices" :key="choice" :value="choice" selected>{{ choice }} · Valeur conservée</option></select>
            </label>
            <label v-else-if="type === 'reference'">Fiche liée
                <select :value="value" @change="update($event.target.value ? Number($event.target.value) : '')"><option value="">Aucune fiche</option><option v-if="value && !allowedTargets.some(target => target.id === Number(value))" :value="value">Fiche indisponible</option><option v-for="target in allowedTargets" :key="target.id" :value="target.id">{{ target.title }}</option></select>
            </label>
            <label v-else-if="type === 'boolean'">Valeur
                <select :value="String(value)" @change="update($event.target.value === '' ? '' : $event.target.value === 'true')"><option value="">Non renseignée</option><option value="true">Oui</option><option value="false">Non</option></select>
            </label>
            <label v-else-if="type === 'choice' && choices.length">Choix
                <select :value="value" @change="update($event.target.value)"><option value="">Non renseigné</option><option v-for="choice in choices" :key="choice" :value="choice">{{ choice }}</option><option v-for="choice in retainedChoices" :key="choice" :value="choice">{{ choice }} · Valeur conservée</option></select>
            </label>
            <label v-else>Valeur
                <input :type="type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'" :step="type === 'number' ? 'any' : undefined"
                    :value="value" @input="update(type === 'number' && $event.target.value !== '' ? Number($event.target.value) : $event.target.value)" @keydown.enter.prevent />
            </label>
            <FicheReferenceCreate v-if="projectId && allowReferenceCreation && ['reference', 'references'].includes(type)" :project-id="projectId"
                :types="creationTypes" :full="referenceFull" @created="useCreatedReference" />
        </template>
    </fieldset>
</template>

<script src="./FicheValueEditor.js"></script>
