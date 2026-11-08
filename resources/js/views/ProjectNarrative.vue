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
                <select v-model="workId" :disabled="busy" @change="showView">
                    <option v-for="item in works" :key="item.public_id" :value="item.public_id">{{ item.title }}</option>
                </select>
            </label>
            <button type="button" @click="$emit('open-content', work.public_id)">Ouvrir l’œuvre</button>
            <fieldset>
                <legend>Exporter l’œuvre</legend>
                <label><input v-model="includeNotes" type="checkbox" /> Inclure les résumés et les blocs de notes</label>
                <p><a :href="exportUrl('txt')">Télécharger en texte</a></p>
                <p><a :href="exportUrl('md')">Télécharger en Markdown</a></p>
            </fieldset>
            <form @submit.prevent="createScene">
                <label>Titre de la scène <input v-model="sceneTitle" required maxlength="255" :disabled="busy" /></label>
                <button type="submit" :disabled="busy">Ajouter une scène</button>
            </form>
            <label>Vue
                <select v-model="view" :disabled="busy" @change="showView">
                    <option value="structure">Ordre du récit</option>
                    <option value="status">Par statut</option>
                    <option value="cards">Cartes de scènes</option>
                    <option value="arcs">Arcs narratifs</option>
                    <option value="choices">Embranchements</option>
                    <option value="dates">Dates dans l’univers</option>
                </select>
            </label>
            <section v-if="view === 'choices'">
                <h2>Embranchements</h2>
                <form @submit.prevent="saveChoice">
                    <fieldset :disabled="busy || !work.scenes.length">
                        <legend>Ajouter ou réorienter un choix</legend>
                        <label>Scène source <select v-model="choiceForm.source" required>
                            <option value="" disabled>Choisir une scène</option>
                            <option v-for="scene in work.scenes" :key="scene.public_id" :value="scene.public_id">{{ scene.title }}</option>
                        </select></label>
                        <label>Libellé du choix <input v-model="choiceForm.label" required maxlength="255" /></label>
                        <label>Scène cible <select v-model="choiceForm.target" required>
                            <option value="" disabled>Choisir une scène</option>
                            <option v-for="scene in work.scenes" :key="scene.public_id" :value="scene.public_id">{{ scene.title }}</option>
                        </select></label>
                        <button type="submit">Enregistrer le choix</button>
                    </fieldset>
                </form>
                <ul>
                    <li v-for="choice in choices" :key="choice.id">
                        {{ sceneTitleFor(choice.source) }} → {{ choice.label }} → {{ sceneTitleFor(choice.target) }}
                        <button type="button" :disabled="busy" @click="removeChoice(choice)">Retirer</button>
                    </li>
                </ul>
                <section aria-label="Aperçu du parcours">
                    <h3>Essayer un parcours</h3>
                    <label>Scène de départ <select :value="previewScene" @change="startPreview($event.target.value)">
                        <option value="">Choisir une scène</option>
                        <option v-for="scene in work.scenes" :key="scene.public_id" :value="scene.public_id">{{ scene.title }}</option>
                    </select></label>
                    <p v-if="previewScene">Scène actuelle · {{ sceneTitleFor(previewScene) }}</p>
                    <p v-if="trail.length">Choix suivis · {{ trail.join(' → ') }}</p>
                    <button v-for="choice in choices.filter(item => item.source === previewScene)" :key="choice.id"
                        type="button" @click="follow(choice)">{{ choice.label }}</button>
                </section>
            </section>
            <section v-else-if="view === 'arcs'">
                <h2>Arcs narratifs</h2>
                <form @submit.prevent="createArc">
                    <label>Titre de l’arc <input v-model="arcTitle" required maxlength="255" :disabled="busy" /></label>
                    <button type="submit" :disabled="busy">Créer un arc</button>
                </form>
                <p v-if="!arcs.length">Aucun arc.</p>
                <article v-for="arc in arcs" :key="arc.public_id">
                    <h3>{{ arc.title }}</h3>
                    <p v-if="arc.summary">{{ arc.summary }}</p>
                    <button type="button" @click="$emit('open-content', arc.public_id)">Ouvrir l’arc</button>
                    <p>{{ arc.completed }} / {{ arc.scenes.length }} scènes terminées</p>
                    <progress v-if="arc.scenes.length" :value="arc.completed" :max="arc.scenes.length" :aria-label="'Progression de ' + arc.title" />
                    <label>Scènes associées
                        <select multiple :disabled="busy" @change="saveArc(arc, $event)">
                            <option v-for="scene in work.scenes" :key="scene.public_id" :value="scene.public_id"
                                :selected="arc.scenes.includes(scene.public_id)">{{ scene.title }}</option>
                        </select>
                    </label>
                </article>
            </section>
            <template v-else-if="view === 'dates'">
                <p v-if="!datedGroups.length">Aucune scène.</p>
                <section v-for="[calendar, scenes] in datedGroups" :key="calendar">
                    <h2>{{ calendar }}</h2>
                    <ul>
                        <li v-for="scene in scenes" :key="scene.public_id">
                            <button type="button" @click="$emit('open-content', scene.public_id)">{{ scene.title }}</button>
                            <span> · Scène {{ scene.narrativePosition }} du récit</span>
                            <span v-if="scene.date?.start"> · {{ scene.date.start }}{{ scene.date.end ? ' – ' + scene.date.end : '' }}</span>
                        </li>
                    </ul>
                </section>
            </template>
            <template v-else>
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
        </template>
    </section>
</template>

<script src="./ProjectNarrative.js"></script>
