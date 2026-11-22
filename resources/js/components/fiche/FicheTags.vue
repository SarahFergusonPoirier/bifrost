<template>
    <ul :id="listId" class="fiche-tags" :aria-label="label">
        <li v-for="tag in visible" :key="tag.id ?? tag.name">
            <details v-if="tag.description">
                <summary>{{ tag.name }}</summary>
                <p>{{ tag.description }}</p>
            </details>
            <template v-else>{{ tag.name }}</template>
        </li>
    </ul>
    <button v-if="limited" type="button" :aria-expanded="expanded" :aria-controls="listId"
        :aria-label="(expanded ? 'Voir moins' : 'Voir tout') + ' – ' + label" @click="expanded = !expanded">
        {{ expanded ? 'Voir moins' : 'Voir tout' }}
    </button>
</template>

<script src="./FicheTags.js"></script>
