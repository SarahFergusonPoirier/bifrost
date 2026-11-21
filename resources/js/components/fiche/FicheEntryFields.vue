<template>
    <fieldset v-if="editable">
        <legend>Champs complémentaires</legend>
        <div v-for="(field, index) in fields" :key="field.id">
            <label>Nom du champ <input :value="field.label" required maxlength="120"
                @input="update(field.id, 'label', $event.target.value)" /></label>
            <FicheTextEditor :label="field.label || 'Valeur du champ'" :model-value="field.value"
                :max-length="1000" :targets="targets" @update:model-value="update(field.id, 'value', $event)" />
            <button type="button" :disabled="index === 0" :aria-label="'Monter le champ ' + field.label" @click="move(index, -1)">Monter</button>
            <button type="button" :disabled="index === fields.length - 1" :aria-label="'Descendre le champ ' + field.label" @click="move(index, 1)">Descendre</button>
            <button type="button" :aria-label="'Retirer le champ ' + field.label" @click="remove(field.id)">Retirer le champ</button>
        </div>
        <button type="button" :disabled="fields.length >= 20" @click="add">Ajouter un champ complémentaire</button>
    </fieldset>
    <dl v-else-if="fields.length" class="fiche-fields">
        <div v-for="field in fields" :key="field.id">
            <dt>{{ field.label }}</dt>
            <dd><FicheText v-if="field.value" :text="field.value" :limit="textLimit"
                :resolve-reference="resolveReference" @open="$emit('open', $event)" /><span v-else>Non renseigné</span></dd>
        </div>
    </dl>
</template>

<script src="./FicheEntryFields.js"></script>
