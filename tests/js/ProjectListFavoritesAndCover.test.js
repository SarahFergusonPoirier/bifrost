import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import ProjectList from '../../resources/js/components/projects/ProjectList.vue';

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
        description: 'Description test',
        tags: [],
        cover_image: null,
        is_favorite: false,
        created_at: '2026-10-01T10:00:00Z',
        ...overrides,
    };
}

function mountProjectList(projects, props = {}) {
    return mount(ProjectList, {
        props: {
            projects,
            ...props,
        },
        global: globalOptions,
    });
}

describe('ProjectList.vue — favoris et couvertures', () => {
    it('affiche la couverture du projet', () => {
        const wrapper = mountProjectList([
            createProject({
                cover_image: 'project-covers/test.jpg',
            }),
        ]);

        const image = wrapper.find('.project-card-cover__image');

        expect(image.exists()).toBe(true);
        expect(image.attributes('src')).toBe(
            '/storage/project-covers/test.jpg'
        );
        expect(image.attributes('alt')).toBe(
            'Couverture du projet Projet test'
        );
    });

    it('affiche un emplacement réservé sans image de couverture', () => {
        const wrapper = mountProjectList([
            createProject(),
        ]);

        expect(
            wrapper.find('.project-card-cover__placeholder').exists()
        ).toBe(true);

        expect(wrapper.find('.project-card-cover__image').exists())
            .toBe(false);
    });

    it('affiche un bouton permettant d’ajouter un favori', async () => {
        const project = createProject();

        const wrapper = mountProjectList([project]);
        const button = wrapper.find('.project-favorite-button');

        expect(button.attributes('aria-pressed')).toBe('false');
        expect(button.attributes('aria-label')).toBe(
            'Ajouter Projet test aux favoris'
        );

        await button.trigger('click');

        expect(wrapper.emitted('toggle-favorite')).toEqual([
            [project],
        ]);
    });

    it('affiche l’état favori et permet de le retirer', async () => {
        const project = createProject({
            is_favorite: true,
        });

        const wrapper = mountProjectList([project]);
        const button = wrapper.find('.project-favorite-button');

        expect(button.attributes('aria-pressed')).toBe('true');
        expect(button.attributes('aria-label')).toBe(
            'Retirer Projet test des favoris'
        );
        expect(button.classes()).toContain(
            'project-favorite-button--active'
        );

        await button.trigger('click');

        expect(wrapper.emitted('toggle-favorite')).toEqual([
            [project],
        ]);
    });

    it('désactive le bouton du favori pendant son enregistrement', () => {
        const wrapper = mountProjectList(
            [createProject({ id: 12 })],
            {
                favoriteLoadingIds: ['12'],
            }
        );

        expect(
            wrapper.find('.project-favorite-button').attributes('disabled')
        ).toBeDefined();
    });

    it('filtre les projets pour n’afficher que les favoris', () => {
        const wrapper = mountProjectList(
            [
                createProject({
                    id: 1,
                    name: 'Projet favori',
                    is_favorite: true,
                }),
                createProject({
                    id: 2,
                    name: 'Projet ordinaire',
                    is_favorite: false,
                }),
            ],
            {
                favoritesOnly: true,
            }
        );

        expect(wrapper.text()).toContain('Projet favori');
        expect(wrapper.text()).not.toContain('Projet ordinaire');
    });

    it('affiche un message si aucun favori ne correspond aux filtres', () => {
        const wrapper = mountProjectList(
            [
                createProject({
                    is_favorite: false,
                }),
            ],
            {
                favoritesOnly: true,
            }
        );

        expect(wrapper.text()).toContain(
            'Tu n’as pas encore de projet favori correspondant aux filtres.'
        );
    });

    it('émet la sélection d’un tag depuis une carte', async () => {
        const project = createProject({
            tags: [
                { id: 4, name: 'Fantasy' },
            ],
        });

        const wrapper = mountProjectList([project]);

        await wrapper
            .find('.project-card-tags button')
            .trigger('click');

        expect(wrapper.emitted('select-tag')).toEqual([[4]]);
    });
});
