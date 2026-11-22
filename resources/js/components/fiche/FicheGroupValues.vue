<template>
    <template v-if="editable">
        <div v-for="field in schema.filter(field => !field.retired)" :key="field.key">
            <FicheValueEditor :label="field.field_definition.label + (field.is_required ? ' · obligatoire' : '')"
                :type="type(field)" :model-value="values[field.key]" :content-id="contentId" :targets="targets"
                :entry-fields="field.display_options?.entry_fields ?? field.field_definition.options_data?.entry_fields"
                :reference-types="field.field_definition.options_data?.content_type_ids"
                :choices="field.display_options?.choices ?? field.field_definition.options_data?.choices"
                :levels="field.display_options?.scale_levels ?? field.field_definition.options_data?.levels"
                :level-mode="field.display_options?.repeatable_level_mode" @update:model-value="update(field, $event)" />
            <p v-if="field.help_text">{{ field.help_text }}</p>
        </div>
        <details v-if="schema.some(field => field.retired && values[field.key] != null)">
            <summary>Données des sous-champs retirés conservées</summary>
            <FicheGroupValues :schema="schema.filter(field => field.retired && values[field.key] != null)" :values="values"
                :content-id="contentId" :targets="targets" :resolve-reference="resolveReference" :text-limit="textLimit" @open="$emit('open', $event)" />
        </details>
    </template>
    <dl v-else-if="schema.length" class="fiche-fields">
        <div v-for="field in schema" :key="field.key">
            <dt>{{ field.field_definition.label }}{{ field.retired ? ' · Donnée conservée' : '' }}</dt>
            <dd>
                <span v-if="state(field) || value(field) == null">{{ formatted(field) }}</span>
                <FicheText v-else-if="type(field) === 'rich_text'" :text="value(field)" :limit="textLimit"
                    :resolve-reference="resolveReference" @open="$emit('open', $event)" />
                <ul v-else-if="['reference', 'references'].includes(type(field))" class="fiche-references">
                    <li v-for="reference in references(field)" :key="reference.id">
                        <button v-if="reference.target" type="button" @click="$emit('open', reference.target.public_id)">{{ reference.target.title }}</button>
                        <span v-else>Fiche indisponible</span>
                    </li>
                </ul>
                <ContentAttachments v-else-if="type(field) === 'image' && contentId" :content-id="contentId" :image-id="value(field).image" gallery single read-only />
                <ContentAttachments v-else-if="type(field) === 'attachment' && contentId" :content-id="contentId" :attachment-id="value(field).attachment" read-only />
                <FicheScale v-else-if="type(field) === 'scale' && Number(value(field).level) <= (field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5)" :label="field.field_definition.label" :level="Number(value(field).level)"
                    :levels="field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5"
                    :mode="field.display_options?.scale_display" :descriptions="field.display_options?.level_descriptions" />
                <a v-else-if="type(field) === 'external_link' && safeUrl(value(field).url)" :href="safeUrl(value(field).url)" target="_blank" rel="noopener noreferrer">{{ formatted(field) }}</a>
                <FicheEntryList v-else-if="['repeatable', 'equipment', 'capabilities', 'keywords', 'bullets'].includes(type(field))"
                    :entries="value(field)" :schema="field.display_options?.entry_fields ?? field.field_definition.options_data?.entry_fields" :level-mode="field.display_options?.repeatable_level_mode"
                    :content-id="contentId" :targets="targets" :resolve-reference="resolveReference" :text-limit="textLimit" @open="$emit('open', $event)" />
                <span v-else>{{ formatted(field) }}</span>
            </dd>
        </div>
    </dl>
</template>

<script src="./FicheGroupValues.js"></script>
