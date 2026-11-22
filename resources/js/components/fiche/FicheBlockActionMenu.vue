<template>
    <details ref="disclosure" class="fiche-block-menu" @keydown.esc.stop.prevent="close(true)">
        <summary ref="trigger" :aria-label="'Actions du bloc ' + title">…</summary>
        <div class="fiche-block-menu__content" @click="activate"><slot /></div>
    </details>
</template>

<script src="./FicheBlockActionMenu.js"></script>
