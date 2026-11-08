<template>
    <div class="app-layout">
        <aside class="app-sidebar" aria-label="Navigation principale">
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
                    <span class="app-navigation__icon" aria-hidden="true">⌂</span>
                    <span>Accueil</span>
                </RouterLink>

            <RouterLink
                    :to="{ name: 'projects' }"
                    class="app-navigation__link"
                    active-class="app-navigation__link--active"
                >
                    <span class="app-navigation__icon" aria-hidden="true">▦</span>
                    <span>Projets</span>
                </RouterLink>

            <RouterLink
                    :to="{ name: 'content-templates' }"
                    class="app-navigation__link"
                    active-class="app-navigation__link--active"
                >
                    <span class="app-navigation__icon" aria-hidden="true">▧</span>
                    <span>Modèles</span>
                </RouterLink>

            <RouterLink :to="{ name: 'contents' }" class="app-navigation__link"
                    active-class="app-navigation__link--active">
                    <span class="app-navigation__icon" aria-hidden="true">▤</span>
                    <span>Corbeille des projets</span>
                </RouterLink>

                <span
                    class="app-navigation__link app-navigation__link--disabled"
                    aria-disabled="true"
                    title="Les archives seront disponibles ultérieurement."
                >
                    <span class="app-navigation__icon" aria-hidden="true">▤</span>
                    <span>Archives</span>
                    <span class="app-navigation__soon">Bientôt</span>
                </span>

                <span
                    class="app-navigation__link app-navigation__link--disabled"
                    aria-disabled="true"
                    title="Les paramètres seront disponibles ultérieurement."
                >
                    <span class="app-navigation__icon" aria-hidden="true">⚙</span>
                    <span>Paramètres</span>
                </span>
            </nav>
                    </slot>
        </aside>

        <div class="app-main">
            <main class="app-content">
                <slot />
            </main>
        </div>
    </div>
</template>
