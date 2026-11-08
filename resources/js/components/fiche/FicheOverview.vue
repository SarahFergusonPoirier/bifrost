<template>
    <div class="fiche-grid">
        <FicheBlock v-if="summary" title="Résumé" icon="catalogue">
            <FicheText :text="summary" />
        </FicheBlock>
        <FicheBlock v-if="tags.length" title="Étiquettes" icon="folder">
            <ul class="fiche-tags">
                <li v-for="tag in tags" :key="tag.id ?? tag.name">{{ tag.name }}</li>
            </ul>
        </FicheBlock>
        <FicheBlock v-for="section in sections" :key="section.title" :title="section.title">
            <dl class="fiche-fields">
                <div v-for="field in section.fields" :key="field.id">
                    <dt>{{ field.label }}</dt>
                    <dd>{{ field.value }}</dd>
                </div>
            </dl>
        </FicheBlock>
        <FicheBlock v-for="block in textBlocks" :key="block.public_id" :title="block.title || 'Texte'" icon="narration">
            <FicheText :text="block.body" />
        </FicheBlock>
        <p v-if="!summary && !tags.length && !sections.length && !textBlocks.length">
            Cette fiche est vide. Ouvre les informations générales pour la compléter.
        </p>
    </div>
</template>

<script src="./FicheOverview.js"></script>
