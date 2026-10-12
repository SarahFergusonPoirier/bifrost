<template>
    <div class="project-tag-input">
        <label>Tags du projet</label>

        <div v-if="selectedTags.length" class="selected-tags">
            <span
                v-for="tag in selectedTags"
                :key="tag"
                class="tag-chip"
            >
                {{ tag }}

                <button
                    type="button"
                    :aria-label="`Retirer le tag ${tag}`"
                    @click="removeTag(tag)"
                >
                    ×
                </button>
            </span>
        </div>

        <div class="tag-entry">
            <input
                v-model="input"
                type="text"
                maxlength="255"
                placeholder="Rechercher ou écrire un tag…"
                autocomplete="off"
                @focus="showSuggestions = true"
                @keydown.enter.prevent="addTag"
            >

            <button
                type="button"
                :disabled="!input.trim() || addingTag"
                @click="addTag"
            >
                {{ addingTag ? 'Ajout…' : 'Ajouter' }}
            </button>
        </div>

        <div
            v-if="showSuggestions"
            class="tag-suggestions"
        >
            <p v-if="loadingTags">Chargement des tags…</p>

            <p v-else-if="matchingTags.length === 0 && !input.trim()">
                Aucun tag disponible.
            </p>

            <button
                v-for="tag in matchingTags"
                :key="tag.id"
                type="button"
                @click="selectTag(tag)"
            >
                {{ tag.name }}
            </button>

            <p
                v-if="input.trim() && !matchingTags.length && !exactMatch"
                class="tag-suggestion-hint"
            >
                Appuie sur « Ajouter » pour créer ce tag.
            </p>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
    </div>
</template>

<script src="./ProjectTagInput.js"></script>