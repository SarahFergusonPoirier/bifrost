<template>
    <div class="fiche-text-editor">
        <label>{{ label }}
            <textarea ref="editor" :value="modelValue ?? ''" @input="$emit('update:modelValue', $event.target.value)" />
        </label>
        <div role="group" :aria-label="'Mise en forme – ' + label">
            <button type="button" @click="bold">Gras</button>
            <button type="button" @click="prefixLines('## ')">Sous-titre</button>
            <button type="button" @click="prefixLines('- ')">Liste à puces</button>
        </div>
        <FicheReferencePicker v-if="targets.length" :model-value="modelValue" :targets="targets"
            @update:model-value="$emit('update:modelValue', $event)" />
    </div>
</template>

<script src="./FicheTextEditor.js"></script>
