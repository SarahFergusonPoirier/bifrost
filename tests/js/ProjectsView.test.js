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
            template: '<a><slot /></a>',
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
        saving: ref(false),
        loadError: ref(''),
        saveError: ref(''),
        loadProjects: vi.fn(),
        addProject: vi.fn().mockResolvedValue({}),
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

    it('affiche le formulaire après un clic sur Nouveau projet', async () => {
        const wrapper = mountProjectsView();

        expect(wrapper.findComponent(ProjectForm).exists()).toBe(false);

        await wrapper.find('.section-heading button').trigger('click');

        expect(wrapper.findComponent(ProjectForm).exists()).toBe(true);
    });

    it('masque le formulaire après un clic sur Annuler', async () => {
        const wrapper = mountProjectsView();

        await wrapper.find('.section-heading button').trigger('click');
        await wrapper.find('.form-actions .button-secondary').trigger('click');

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

    it('crée un projet et ferme le formulaire après la réussite', async () => {
        const addProject = vi.fn().mockResolvedValue({
            id: 1,
            name: 'Mon projet',
            description: 'Ma description',
        });

        useProjects.mockReturnValue(
            createProjectsState({ addProject })
        );

        const wrapper = mountProjectsView();

        await wrapper.find('.section-heading button').trigger('click');

        await wrapper.findComponent(ProjectForm).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(addProject).toHaveBeenCalledWith({
            name: 'Mon projet',
            description: 'Ma description',
        });
        expect(wrapper.findComponent(ProjectForm).exists()).toBe(false);
    });

    it('transmet les tags lors de la création d’un projet', async () => {
        const projectData = {
            name: 'Mon projet',
            description: 'Ma description',
            tags: ['Lecture', 'Programmation'],
        };

        const addProject = vi.fn().mockResolvedValue({
            id: 1,
            ...projectData,
        });

        useProjects.mockReturnValue(
            createProjectsState({ addProject })
        );

        getTags.mockResolvedValue(availableTags);

        const wrapper = mountProjectsView();

        await flushPromises();

        await wrapper.find('.section-heading button').trigger('click');

        await wrapper.findComponent(ProjectForm).vm.$emit(
            'submit',
            projectData
        );

        await flushPromises();

        expect(addProject).toHaveBeenCalledWith(projectData);
        expect(wrapper.findComponent(ProjectForm).exists()).toBe(false);
        expect(getTags).toHaveBeenCalled();
    });

    it('garde le formulaire ouvert si la création échoue', async () => {
        const addProject = vi.fn().mockRejectedValue(
            new Error('Erreur de création')
        );

        useProjects.mockReturnValue(
            createProjectsState({
                addProject,
                saveError: ref('Erreur de création'),
            })
        );

        const wrapper = mountProjectsView();

        await wrapper.find('.section-heading button').trigger('click');

        await wrapper.findComponent(ProjectForm).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(wrapper.findComponent(ProjectForm).exists()).toBe(true);
    });

    it('affiche le projet créé dans la liste', async () => {
        const projects = ref([]);

        const addProject = vi.fn().mockImplementation(async projectData => {
            const project = { id: 1, ...projectData };
            projects.value.unshift(project);
            return project;
        });

        useProjects.mockReturnValue(
            createProjectsState({ projects, addProject })
        );

        const wrapper = mountProjectsView();

        await wrapper.find('.section-heading button').trigger('click');

        await wrapper.findComponent(ProjectForm).vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(wrapper.text()).toContain('Mon projet');
        expect(wrapper.text()).toContain('Ma description');
    });

    it('affiche le message de chargement pendant le chargement des projets', () => {
        useProjects.mockReturnValue(
            createProjectsState({ loading: ref(true) })
        );

        const wrapper = mountProjectsView();

        expect(wrapper.text()).toContain('Chargement des projets…');
    });

    it('empêche une nouvelle soumission pendant la création', async () => {
        let resolveCreation;

        const saving = ref(false);

        const addProject = vi.fn(() => {
            saving.value = true;

            return new Promise(resolve => {
                resolveCreation = project => {
                    saving.value = false;
                    resolve(project);
                };
            });
        });

        useProjects.mockReturnValue(
            createProjectsState({ saving, addProject })
        );

        const wrapper = mountProjectsView();

        await wrapper.find('.section-heading button').trigger('click');

        const form = wrapper.findComponent(ProjectForm);

        form.vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();

        expect(addProject).toHaveBeenCalledTimes(1);

        form.vm.$emit('submit', {
            name: 'Mon projet',
            description: 'Ma description',
        });

        expect(addProject).toHaveBeenCalledTimes(1);

        resolveCreation({
            id: 1,
            name: 'Mon projet',
            description: 'Ma description',
        });

        await flushPromises();
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