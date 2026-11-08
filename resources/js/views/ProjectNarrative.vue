<template>
    <section>
        <h1>Narration</h1>
        <p v-if="error" role="alert">{{ error }}</p>
        <form @submit.prevent="createWork">
            <label>Titre de l’œuvre <input v-model="title" required maxlength="255" :disabled="busy" /></label>
            <button type="submit" :disabled="busy">Créer une œuvre</button>
        </form>

        <template v-if="work">
            <label>Œuvre
                <select v-model="workId" :disabled="busy">
                    <option v-for="item in works" :key="item.public_id" :value="item.public_id">{{ item.title }}</option>
                </select>
            </label>
            <button type="button" @click="$emit('open-content', work.public_id)">Ouvrir l’œuvre</button>
            <form @submit.prevent="createScene">
                <label>Titre de la scène <input v-model="sceneTitle" required maxlength="255" :disabled="busy" /></label>
                <button type="submit" :disabled="busy">Ajouter une scène</button>
            </form>
            <label>Vue
                <select v-model="view">
                    <option value="structure">Ordre du récit</option>
                    <option value="status">Par statut</option>
                    <option value="cards">Cartes de scènes</option>
                </select>
            </label>
            <section v-for="[label, scenes] in groups" :key="label">
                <h2>{{ label }}</h2>
                <p v-if="!scenes.length">Aucune scène.</p>
                <ol v-else>
                    <li v-for="(scene, index) in scenes" :key="scene.public_id">
                        <button type="button" @click="$emit('open-content', scene.public_id)">{{ scene.title }}</button>
                        <span> · {{ statuses[scene.work_status_key] }}</span>
                        <p v-if="view === 'cards'">{{ scene.summary || 'Aucun résumé.' }}</p>
                        <template v-if="view === 'structure'">
                            <button type="button" :disabled="busy || index === 0" @click="move(index, -1)">Monter</button>
                            <button type="button" :disabled="busy || index === scenes.length - 1" @click="move(index, 1)">Descendre</button>
                        </template>
                    </li>
                </ol>
            </section>
        </template>
    </section>
</template>

<script src="./ProjectNarrative.js"></script>
