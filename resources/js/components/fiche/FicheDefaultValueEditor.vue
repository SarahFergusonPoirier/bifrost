<template>
    <FicheValueEditor v-bind="$props" label="Valeur par défaut" @update:model-value="$emit('update:modelValue', $event)" />
</template>

<script src="./FicheDefaultValueEditor.js"></script>
