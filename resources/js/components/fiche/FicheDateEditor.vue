<template>
    <fieldset>
        <legend>{{ label }}</legend>
        <label>Date <input type="date" :value="modelValue?.value_date?.slice(0, 10) ?? ''" @input="updateDate($event.target.value)" /></label>
        <template v-if="modelValue?.value_date">
            <label><input type="checkbox" :checked="Boolean(modelValue.date_options?.timeline)" @change="updateOption('timeline', $event.target.checked)" /> Ajouter à la chronologie</label>
            <template v-if="modelValue.date_options?.timeline">
                <label>Calendrier <input :value="modelValue.date_options.calendar ?? ''" maxlength="255" @change="updateOption('calendar', $event.target.value)" /></label>
                <label>Titre dans la chronologie <input :value="modelValue.date_options.timeline_title ?? ''" maxlength="255" @change="updateOption('timeline_title', $event.target.value)" /></label>
                <label>Description <textarea :value="modelValue.date_options.timeline_description ?? ''" maxlength="10000" @change="updateOption('timeline_description', $event.target.value)" /></label>
            </template>
        </template>
    </fieldset>
</template>

<script src="./FicheDateEditor.js"></script>
