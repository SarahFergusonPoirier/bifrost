<template>
    <FicheValueEditor v-bind="$props" label="Valeur par défaut" @reference-created="$emit('reference-created', $event)" @update:model-value="$emit('update:modelValue', $event)" />
</template>

<script src="./FicheDefaultValueEditor.js"></script>
