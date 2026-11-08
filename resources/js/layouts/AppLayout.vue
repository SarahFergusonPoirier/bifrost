<template>
    <div class="app-layout" :style="{ '--sidebar-width': sidebarWidth + 'px' }">
        <aside id="app-sidebar" class="app-sidebar" aria-label="Navigation principale">
            <slot name="sidebar">
            <RouterLink
                :to="{ name: 'home' }"
                class="app-logo"
            >
                Bifrost
            </RouterLink>

            <nav class="app-navigation" aria-label="Menu principal">
            <RouterLink
                    :to="{ name: 'home' }"
                    class="app-navigation__link"
                    exact-active-class="app-navigation__link--active"
                >
                    <i class="app-navigation__icon fi-rr-home" aria-hidden="true"></i>
                    <span>Accueil</span>
                </RouterLink>

            <RouterLink
                    :to="{ name: 'projects' }"
                    class="app-navigation__link"
                    active-class="app-navigation__link--active"
                >
                    <i class="app-navigation__icon fi-rr-layers" aria-hidden="true"></i>
                    <span>Projets</span>
                </RouterLink>

            <RouterLink
                    :to="{ name: 'content-templates' }"
                    class="app-navigation__link"
                    active-class="app-navigation__link--active"
                >
                    <i class="app-navigation__icon fi-rr-book-alt" aria-hidden="true"></i>
                    <span>Modèles</span>
                </RouterLink>

            <RouterLink :to="{ name: 'contents' }" class="app-navigation__link"
                    active-class="app-navigation__link--active">
                    <i class="app-navigation__icon fi-rr-trash" aria-hidden="true"></i>
                    <span>Corbeille des projets</span>
                </RouterLink>

                <span
                    class="app-navigation__link app-navigation__link--disabled"
                    aria-disabled="true"
                    title="Les archives seront disponibles ultérieurement."
                >
                    <i class="app-navigation__icon fi-rr-archive" aria-hidden="true"></i>
                    <span>Archives</span>
                    <span class="app-navigation__soon">Bientôt</span>
                </span>

                <span
                    class="app-navigation__link app-navigation__link--disabled"
                    aria-disabled="true"
                    title="Les paramètres seront disponibles ultérieurement."
                >
                    <i class="app-navigation__icon fi-rr-settings" aria-hidden="true"></i>
                    <span>Paramètres</span>
                </span>
            </nav>
                    </slot>
            <label class="app-theme">
                Apparence
                <select :value="theme" @change="chooseTheme($event.target.value)">
                    <option value="system">Système</option>
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                </select>
            </label>
            <small class="workspace-icon-credit">UIcons par <a href="https://www.flaticon.com/uicons">Flaticon</a></small>
        </aside>

        <div class="app-sidebar-resize" role="separator" tabindex="0" aria-orientation="vertical"
            aria-label="Largeur de la barre latérale" aria-controls="app-sidebar"
            :aria-valuemin="minWidth" :aria-valuemax="maxWidth" :aria-valuenow="sidebarWidth"
            @keydown="resizeWithKeyboard" @pointerdown.prevent="startResize" @pointermove="resize"
            @pointerup="endResize" @pointercancel="endResize" @lostpointercapture="endResize"></div>

        <div class="app-main">
            <main class="app-content">
                <slot />
            </main>
        </div>
    </div>
</template>

<script src="./AppLayout.js"></script>
