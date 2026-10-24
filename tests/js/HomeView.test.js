import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';

import HomeView from '../../resources/js/views/HomeView.vue';
import { useProjects } from '../../resources/js/composables/useProjects';
import { updateProjectFavorite } from '../../resources/js/services/project';

vi.mock('../../resources/js/composables/useProjects', () => ({
    useProjects: vi.fn(),
}));

vi.mock('../../resources/js/services/project', () => ({
    updateProjectFavorite: vi.fn(),
}));

const globalOptions = {
    stubs: {
        RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
        },
    },
};

function createProject(overrides = {}) {
    return {
        id: 1,
        name: 'Projet test',
        description: 'Description du projet',
        tags: [],
        cover_image: null,
        is_favorite: false,
        created_at: '2026-10-01T10:00:00Z',
        updated_at: '2026-10-01T10:00:00Z',
        ...overrides,
    };
}

function createProjectsState(projects = [], overrides = {}) {
    return {
        projects: ref(projects),
        loading: ref(false),
        loadError: ref(''),
        loadProjects: vi.fn(),
        ...overrides,
    };
}

function mountHomeView() {
    return mount(HomeView, {
        global: globalOptions,
    });
}

describe('HomeView.vue — favoris et couvertures', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useProjects.mockReturnValue(createProjectsState());
        updateProjectFavorite.mockResolvedValue({});
    });

    it('charge les projets au montage', () => {
        const loadProjects = vi.fn();

        useProjects.mockReturnValue(
            createProjectsState([], { loadProjects })
        );

        mountHomeView();

        expect(loadProjects).toHaveBeenCalledOnce();
    });

    it('affiche le message de chargement', () => {
        useProjects.mockReturnValue(
            createProjectsState([], {
                loading: ref(true),
            })
        );

        const wrapper = mountHomeView();

        expect(wrapper.text()).toContain('Chargement de tes projets…');
    });

    it('affiche le message lorsque aucun projet existe', () => {
        const wrapper = mountHomeView();

        expect(wrapper.text()).toContain(
            'Crée ton premier projet et donne vie à tes idées.'
        );
        expect(wrapper.find('.home-empty').exists()).toBe(true);
    });

    it('met en avant le projet modifié le plus récemment', () => {
        useProjects.mockReturnValue(
            createProjectsState([
                createProject({
                    id: 1,
                    name: 'Ancien projet',
                    updated_at: '2026-10-01T10:00:00Z',
                }),
                createProject({
                    id: 2,
                    name: 'Projet récent',
                    updated_at: '2026-10-20T10:00:00Z',
                }),
            ])
        );

        const wrapper = mountHomeView();

        expect(
            wrapper.find('.home-featured-card__content').text()
        ).toContain('Projet récent');

        expect(wrapper.find('.home-recent-grid').text())
            .toContain('Ancien projet');
    });

    it('affiche les images de couverture du projet à la une et des projets récents', () => {
        useProjects.mockReturnValue(
            createProjectsState([
                createProject({
                    id: 1,
                    name: 'Projet à la une',
                    cover_image: 'project-covers/featured.jpg',
                    updated_at: '2026-10-20T10:00:00Z',
                }),
                createProject({
                    id: 2,
                    name: 'Projet récent',
                    cover_image: 'project-covers/recent.jpg',
                    updated_at: '2026-10-19T10:00:00Z',
                }),
            ])
        );

        const wrapper = mountHomeView();

        const featuredImage = wrapper.find(
            '.home-featured-card__cover img'
        );
        const recentImage = wrapper.find(
            '.home-recent-card__cover img'
        );

        expect(featuredImage.exists()).toBe(true);
        expect(featuredImage.attributes('src')).toBe(
            '/storage/project-covers/featured.jpg'
        );
        expect(featuredImage.attributes('alt')).toBe(
            'Couverture de Projet à la une'
        );

        expect(recentImage.exists()).toBe(true);
        expect(recentImage.attributes('src')).toBe(
            '/storage/project-covers/recent.jpg'
        );
        expect(recentImage.attributes('alt')).toBe(
            'Couverture de Projet récent'
        );
    });

    it('affiche un emplacement réservé quand le projet n’a pas de couverture', () => {
        useProjects.mockReturnValue(
            createProjectsState([
                createProject({
                    cover_image: null,
                }),
            ])
        );

        const wrapper = mountHomeView();

        expect(
            wrapper.find('.home-featured-card .home-cover-placeholder').exists()
        ).toBe(true);

        expect(
            wrapper.find('.home-featured-card__cover img').exists()
        ).toBe(false);
    });

    it('ajoute le projet à la liste des favoris', async () => {
        const project = createProject({ id: 7 });

        useProjects.mockReturnValue(
            createProjectsState([project])
        );

        const wrapper = mountHomeView();

        const button = wrapper.find(
            '.home-featured-card .home-favorite-button'
        );

        expect(button.attributes('aria-pressed')).toBe('false');
        expect(button.attributes('aria-label')).toBe(
            'Ajouter aux favoris'
        );

        await button.trigger('click');
        await flushPromises();

        expect(updateProjectFavorite).toHaveBeenCalledWith(7, true);
        expect(project.is_favorite).toBe(true);
        expect(button.attributes('aria-pressed')).toBe('true');
        expect(button.attributes('aria-label')).toBe(
            'Retirer des favoris'
        );
    });

    it('retire un projet des favoris', async () => {
        const project = createProject({
            id: 8,
            is_favorite: true,
        });

        useProjects.mockReturnValue(
            createProjectsState([project])
        );

        const wrapper = mountHomeView();

        await wrapper
            .find('.home-featured-card .home-favorite-button')
            .trigger('click');

        await flushPromises();

        expect(updateProjectFavorite).toHaveBeenCalledWith(8, false);
        expect(project.is_favorite).toBe(false);
    });

    it('affiche une erreur si la mise à jour du favori échoue', async () => {
        const project = createProject({ id: 9 });

        useProjects.mockReturnValue(
            createProjectsState([project])
        );

        updateProjectFavorite.mockRejectedValue(
            new Error('Erreur de sauvegarde du favori.')
        );

        const wrapper = mountHomeView();

        await wrapper
            .find('.home-featured-card .home-favorite-button')
            .trigger('click');

        await flushPromises();

        expect(project.is_favorite).toBe(false);
        expect(wrapper.find('[role="alert"]').text()).toBe(
            'Erreur de sauvegarde du favori.'
        );
    });

    it('désactive le bouton pendant la mise à jour du favori', async () => {
        const project = createProject({ id: 10 });

        useProjects.mockReturnValue(
            createProjectsState([project])
        );

        let resolveFavorite;

        updateProjectFavorite.mockReturnValue(
            new Promise((resolve) => {
                resolveFavorite = resolve;
            })
        );

        const wrapper = mountHomeView();
        const button = wrapper.find(
            '.home-featured-card .home-favorite-button'
        );

        await button.trigger('click');

        expect(button.attributes('disabled')).toBeDefined();

        resolveFavorite({});
        await flushPromises();

        expect(button.attributes('disabled')).toBeUndefined();
    });

    it('permet de modifier le favori d’un projet récent', async () => {
        const featured = createProject({
            id: 1,
            name: 'Projet à la une',
            updated_at: '2026-10-20T10:00:00Z',
        });

        const recent = createProject({
            id: 2,
            name: 'Projet récent',
            updated_at: '2026-10-19T10:00:00Z',
        });

        useProjects.mockReturnValue(
            createProjectsState([featured, recent])
        );

        const wrapper = mountHomeView();

        await wrapper
            .find('.home-recent-card .home-favorite-button')
            .trigger('click');

        await flushPromises();

        expect(updateProjectFavorite).toHaveBeenCalledWith(2, true);
        expect(recent.is_favorite).toBe(true);
    });
});
