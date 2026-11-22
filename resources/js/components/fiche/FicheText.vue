<template>
    <div class="fiche-text">
        <div class="fiche-text__body">
            <template v-for="(block, index) in blocks" :key="index">
                <ul v-if="block.type === 'ul'" class="fiche-entry-list">
                    <li v-for="(item, itemIndex) in block.items" :key="itemIndex"><FicheInlineText :text="item" :resolve-reference="resolveReference" @open="$emit('open', $event)" /></li>
                </ul>
                <component :is="block.type" v-else><FicheInlineText :text="block.text || ' '" :resolve-reference="resolveReference" @open="$emit('open', $event)" /></component>
            </template>
        </div>
        <button v-if="canTruncate" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
            {{ expanded ? 'Voir moins' : 'Voir plus' }}
        </button>
    </div>
</template>

<script src="./FicheText.js"></script>
