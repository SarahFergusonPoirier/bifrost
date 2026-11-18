<template>
    <div class="fiche-text-editor">
        <label>{{ label }}
            <textarea ref="editor" :value="modelValue ?? ''" :maxlength="maxLength" @input="updateText($event.target.value)" />
        </label>
        <div role="group" :aria-label="'Mise en forme – ' + label">
            <button type="button" @click="bold">Gras</button>
            <button type="button" @click="prefixLines('## ')">Sous-titre</button>
            <button type="button" @click="prefixLines('- ')">Liste à puces</button>
        </div>
        <FicheReferencePicker v-if="targets.length" :targets="targets" @insert="insertReference" />
        <p v-if="limitReached" role="status">Cette modification dépasserait la limite de {{ maxLength }} caractères.</p>
    </div>
</template>

<script src="./FicheTextEditor.js"></script>
