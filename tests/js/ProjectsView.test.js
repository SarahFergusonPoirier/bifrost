import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

import ProjectsView from '../../resources/js/views/ProjectsView.vue';
import ProjectForm from '../../resources/js/components/projects/ProjectForm.vue';
import { useProjects } from '../../resources/js/composables/useProjects';
import { getTags } from '../../resources/js/services/tag';

vi.mock('../../resources/js/composables/useProjects', () => ({
    useProjects: vi.fn(),
}));

vi.mock('../../resources/js/services/tag', () => ({
    getTags: vi.fn(),
}));

const globalOptions = {
    stubs: {
        RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : to.name"><slot /></a>',
        },
    },
};

const availableTags = [
    { id: 1, name: 'Lecture' },
    { id: 2, name: 'Programmation' },
];

function createProjectsState(overrides = {}) {
    return {
        projects: ref([]),
        loading: ref(false),
        loadError: ref(''),
        loadProjects: vi.fn(),
        ...overrides,
    };
}

function mountProjectsView() {
    return mount(ProjectsView, {
        global: globalOptions,
    });
}

function mountProjectsViewWithProjects() {
    useProjects.mockReturnValue(
        createProjectsState({
            projects: ref([
                {
                    id: 1,
                    name: 'Projet test',
                    description: 'Description test',
                    tags: [],
                },
            ]),
        })
    );

    return mountProjectsView();
}

describe('ProjectsView.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getTags.mockResolvedValue([]);
        useProjects.mockReturnValue(createProjectsState());
    });

    it('affiche le titre de la page', () => {
        const wrapper = mountProjectsView();

        expect(wrapper.find('h1').text()).toBe('Mes projets');
        expect(wrapper.find('h2').text()).toBe('Projets');
    });

    it('affiche un lien vers la page de création', () => {
        const wrapper = mountProjectsView();
        const createLink = wrapper.find('.section-heading a');

        expect(createLink.exists()).toBe(true);
        expect(createLink.text()).toContain('Nouveau projet');
        expect(createLink.attributes('href')).toBe('project-create');
    });

    it('ne contient plus le formulaire de création sur la page d’accueil', () => {
        const wrapper = mountProjectsView();

        expect(wrapper.findComponent(ProjectForm).exists()).toBe(false);
    });

    it('charge les projets au montage', () => {
        const loadProjects = vi.fn();

        useProjects.mockReturnValue(
            createProjectsState({ loadProjects })
        );

        mountProjectsView();

        expect(loadProjects).toHaveBeenCalledOnce();
    });

    it('charge les tags au montage', async () => {
        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsView();

        await flushPromises();

        expect(getTags).toHaveBeenCalledOnce();
        expect(wrapper.vm.tags).toEqual(availableTags);
    });

    it('affiche les tags disponibles comme filtres', async () => {
        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        const filterButtons = wrapper.findAll(
            '.project-tag-filters .tag-filter-button'
        );

        expect(filterButtons).toHaveLength(2);
        expect(filterButtons.map(button => button.text())).toEqual([
            'Lecture',
            'Programmation',
        ]);
    });

    it('sélectionne un tag comme filtre', async () => {
        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        const lectureButton = wrapper
            .findAll('.project-tag-filters .tag-filter-button')
            .find(button => button.text() === 'Lecture');

        await lectureButton.trigger('click');

        expect(wrapper.vm.selectedTagIds).toEqual(['1']);
        expect(lectureButton.attributes('aria-pressed')).toBe('true');
    });

    it('désélectionne un tag lorsqu’on clique à nouveau dessus', async () => {
        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        const lectureButton = wrapper
            .findAll('.project-tag-filters .tag-filter-button')
            .find(button => button.text() === 'Lecture');

        await lectureButton.trigger('click');
        await lectureButton.trigger('click');

        expect(wrapper.vm.selectedTagIds).toEqual([]);
        expect(lectureButton.attributes('aria-pressed')).toBe('false');
    });

    it('réinitialise les filtres de tags avec le bouton Tous', async () => {
        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        await wrapper.vm.selectTag(1);
        await wrapper.vm.selectTag(2);

        await wrapper
            .find('.project-tag-filters button')
            .trigger('click');

        expect(wrapper.vm.selectedTagIds).toEqual([]);
    });

    it('affiche une erreur si le chargement des tags échoue', async () => {
        getTags.mockRejectedValue(
            new Error('Impossible de charger les tags.')
        );

        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        expect(wrapper.vm.tagError).toBe(
            'Impossible de charger les tags.'
        );
        expect(wrapper.find('.project-tag-filters').exists()).toBe(true);
        expect(wrapper.find('.error').text()).toBe(
            'Impossible de charger les tags.'
        );
    });

    it('affiche le projet dans la liste', async () => {
        const wrapper = mountProjectsViewWithProjects();

        await flushPromises();

        expect(wrapper.text()).toContain('Projet test');
        expect(wrapper.text()).toContain('Description test');
    });

    it('affiche le message de chargement pendant le chargement des projets', () => {
        useProjects.mockReturnValue(
            createProjectsState({ loading: ref(true) })
        );

        const wrapper = mountProjectsView();

        expect(wrapper.text()).toContain('Chargement des projets…');
    });

    it('masque les filtres lorsqu’aucun projet n’existe', () => {
        const wrapper = mountProjectsView();

        expect(wrapper.find('.project-filters').exists()).toBe(false);
        expect(wrapper.find('.project-tag-filters').exists()).toBe(false);
        expect(wrapper.text()).toContain(
            'Tu n’as pas encore créé de projet.'
        );
        expect(wrapper.text()).toContain('+ Nouveau projet');
    });
});